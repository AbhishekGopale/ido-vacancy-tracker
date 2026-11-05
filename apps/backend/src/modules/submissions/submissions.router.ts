import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { enqueueEmail } from '../../queue/emailQueue.js';

export const submissionsRouter = Router();

const emptyToNull = (val: any) => (typeof val === 'string' && val.trim() === '' ? null : val);

const submitCandidateSchema = z
  .object({
    vacancyId: z.string().uuid('Invalid vacancy ID'),
    fullName: z.string().min(2, 'Candidate Full Name must be at least 2 characters'),
    email: z.preprocess(emptyToNull, z.string().email('Invalid email address format').nullable().optional()),
    phone: z.preprocess(emptyToNull, z.string().min(5, 'Phone number must be at least 5 digits').nullable().optional()),
    resumeId: z.preprocess(emptyToNull, z.string().nullable().optional()),
    resumeUrl: z.preprocess(emptyToNull, z.string().nullable().optional()),
  })
  .refine((data) => !!data.email || !!data.phone, {
    message: 'At least one contact method (Email Address or Phone Number) is required.',
    path: ['email'],
  });

const processActionSchema = z.object({
  token: z.string(),
  action: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
  comments: z.string().optional(),
});

// Helper: Generate tokenized single-use link for an approver level
async function generateSingleUseToken(submissionId: string, level: number): Promise<string> {
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  await prisma.tokenNonce.create({
    data: {
      nonce,
      submissionId,
      level,
      expiresAt,
    },
  });

  const token = jwt.sign(
    {
      submissionId,
      level,
      nonce,
    },
    env.JWT_SECRET,
    { expiresIn: '72h' }
  );

  return token;
}

// POST /api/v1/submissions (Zone Recruiter upload with Strict Single-Candidate Constraint)
submissionsRouter.post('/', requireAuth, requirePermission('submissions.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = submitCandidateSchema.parse(req.body);

    const vacancy = await prisma.vacancy.findUnique({
      where: { id: data.vacancyId },
      include: {
        project: {
          include: { pmUser: true },
        },
        projectRole: true,
        submissions: {
          where: { status: { in: ['PENDING', 'APPROVED'] } },
        },
      },
    });

    if (!vacancy) {
      throw new AppError('Vacancy not found', 404);
    }

    if (vacancy.status !== 'ACTIVE') {
      throw new AppError(`Vacancy ${vacancy.vacancyCode || ''} is currently ${vacancy.status} and not accepting submissions.`, 400);
    }

    // STRICT SINGLE-CANDIDATE CONSTRAINT
    if (vacancy.submissions.length > 0) {
      throw new AppError(
        `STRICT SINGLE-CANDIDATE CONSTRAINT: Vacancy ${vacancy.vacancyCode} already has an active candidate in review. Concurrent candidate submissions are locked until current review completes.`,
        409
      );
    }

    // Create Candidate Submission
    const submission = await prisma.candidateSubmission.create({
      data: {
        vacancyId: data.vacancyId,
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        resumeId: data.resumeId || null,
        resumeUrl: data.resumeUrl || null,
        currentLevel: 1, // Level 1 review
        status: 'PENDING',
      },
    });

    const requiredLevels = vacancy.projectRole?.approvalLevelsCount !== undefined ? vacancy.projectRole.approvalLevelsCount : 2;

    if (requiredLevels === 0) {
      // Direct Hire / No approval tier required!
      await prisma.candidateSubmission.update({
        where: { id: submission.id },
        data: { status: 'APPROVED' },
      });
      await prisma.vacancy.update({
        where: { id: vacancy.id },
        data: { status: 'FILLED' },
      });
      res.status(201).json({
        success: true,
        message: `Candidate ${submission.fullName} directly HIRED for ${vacancy.vacancyCode} (Role configured with No Approval Required).`,
        data: submission,
      });
      return;
    }

    // Set Vacancy Status to PENDING_APPROVAL
    await prisma.vacancy.update({
      where: { id: vacancy.id },
      data: { status: 'PENDING_APPROVAL' },
    });

    // Generate unique Approval Checking ID
    const checkingId = `APPR-${vacancy.vacancyCode || 'REQ'}-${submission.id.slice(0, 8).toUpperCase()}`;

    // Determine Level 1 Approver Email (defaults to divya@idonneous.com)
    const l1Email =
      vacancy.approverL1Email ||
      vacancy.projectRole?.defaultL1Email ||
      vacancy.project.pmUser?.email ||
      'divya@idonneous.com';

    // Generate Level 1 Token
    const token = await generateSingleUseToken(submission.id, 1);

    // Enqueue Level 1 Approval Request Email with simple transmit protocol
    await enqueueEmail('l1-approval-request', {
      to: l1Email,
      subject: `[Action Required] Checking ID ${checkingId} — Level 1 Approval for ${submission.fullName} (${vacancy.vacancyCode})`,
      template: 'APPROVAL_REQUEST',
      data: {
        checkingId,
        level: 1,
        vacancyCode: vacancy.vacancyCode,
        jobTitle: vacancy.title,
        projectName: vacancy.project.name,
        zone: vacancy.zone,
        area: vacancy.area,
        candidateName: submission.fullName,
        candidateEmail: submission.email || 'N/A',
        candidatePhone: submission.phone || 'N/A',
        resumeId: submission.resumeId,
        token,
        clientUrl: env.CLIENT_URL,
      },
    });

    res.status(201).json({
      success: true,
      message: `Candidate ${submission.fullName} submitted successfully for ${vacancy.vacancyCode} (Checking ID: ${checkingId}). 1-Click review email dispatched to ${l1Email}.`,
      data: {
        ...submission,
        checkingId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/submissions/approve-token (Validate 1-click tokenized link)
submissionsRouter.get('/approve-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      throw new AppError('Approval token is required', 400);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      submissionId: string;
      level: number;
      nonce: string;
    };

    const tokenEntry = await prisma.tokenNonce.findUnique({
      where: { nonce: decoded.nonce },
    });

    if (!tokenEntry) {
      throw new AppError('Invalid approval token', 401);
    }

    if (tokenEntry.usedAt) {
      throw new AppError('This approval link has already been used.', 410);
    }

    if (tokenEntry.expiresAt < new Date()) {
      throw new AppError('This approval link has expired.', 410);
    }

    const submission = await prisma.candidateSubmission.findUnique({
      where: { id: decoded.submissionId },
      include: {
        vacancy: {
          include: {
            project: { include: { pmUser: true } },
            projectRole: true,
          },
        },
      },
    });

    if (!submission) {
      throw new AppError('Submission record not found', 404);
    }

    const checkingId = `APPR-${submission.vacancy?.vacancyCode || 'REQ'}-${submission.id.slice(0, 8).toUpperCase()}`;
    const vac = submission.vacancy;
    let approverEmail = 'divya@idonneous.com';
    if (decoded.level === 1) {
      approverEmail = vac.approverL1Email || vac.projectRole?.defaultL1Email || vac.project?.pmUser?.email || 'divya@idonneous.com';
    } else if (decoded.level === 2) {
      approverEmail = vac.approverL2Email || vac.projectRole?.defaultL2Email || vac.projectRole?.asmEmail || vac.project?.asmEmail || 'divya@idonneous.com';
    } else if (decoded.level === 3) {
      approverEmail = vac.approverL3Email || vac.projectRole?.defaultL3Email || vac.projectRole?.rsmEmail || vac.project?.rsmEmail || 'divya@idonneous.com';
    }

    res.json({
      success: true,
      data: {
        submission,
        level: decoded.level,
        checkingId,
        approverEmail,
        senderEmail: 'abhishek.gopale@idonneous.com',
        token,
      },
    });
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      next(new AppError('This approval link has expired.', 410));
      return;
    }
    next(err);
  }
});

// POST /api/v1/submissions/process-action (Process 1-Click Approval or Mandatory Rejection)
submissionsRouter.post('/process-action', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, action, rejectionReason, comments } = processActionSchema.parse(req.body);

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      submissionId: string;
      level: number;
      nonce: string;
    };

    const tokenEntry = await prisma.tokenNonce.findUnique({
      where: { nonce: decoded.nonce },
    });

    if (!tokenEntry || tokenEntry.usedAt) {
      throw new AppError('This token has already been used or is invalid.', 410);
    }

    const submission = await prisma.candidateSubmission.findUnique({
      where: { id: decoded.submissionId },
      include: {
        vacancy: {
          include: {
            project: { include: { pmUser: true } },
            projectRole: true,
            assignedRecruiter: true,
          },
        },
      },
    });

    if (!submission || submission.status !== 'PENDING') {
      throw new AppError('Submission is no longer pending review.', 400);
    }

    // Mark token as used immediately
    await prisma.tokenNonce.update({
      where: { nonce: decoded.nonce },
      data: { usedAt: new Date() },
    });

    const level = decoded.level;
    const vacancy = submission.vacancy;
    const requiredLevels = vacancy.projectRole?.approvalLevelsCount || 2;

    // --- CASE A: REJECTION FLOW (CONTINUOUS REJECTION LOOP) ---
    if (action === 'REJECTED') {
      if (!rejectionReason) {
        throw new AppError('A structured rejection reason is mandatory when rejecting a candidate.', 400);
      }

      // Update candidate submission to REJECTED
      await prisma.candidateSubmission.update({
        where: { id: submission.id },
        data: {
          status: 'REJECTED',
          rejectionReason,
          rejectionComments: comments || null,
        },
      });

      // Log Audit record
      await prisma.approvalAudit.create({
        data: {
          submissionId: submission.id,
          level,
          reviewerEmail:
            level === 1
              ? vacancy.approverL1Email || vacancy.project.pmUser?.email || 'pm@recruitment.local'
              : level === 2
              ? vacancy.approverL2Email || vacancy.projectRole?.defaultL2Email || vacancy.project.asmEmail
              : vacancy.approverL3Email || vacancy.projectRole?.defaultL3Email || vacancy.project.rsmEmail,
          action: 'REJECTED',
          reason: rejectionReason,
          comments: comments || null,
        },
      });

      // AUTOMATICALLY RESET VACANCY STATUS BACK TO ACTIVE
      await prisma.vacancy.update({
        where: { id: submission.vacancyId },
        data: { status: 'ACTIVE' },
      });

      // Enqueue Replacement Alert to Zone Recruiter
      if (vacancy.assignedRecruiter) {
        await enqueueEmail('replacement-required', {
          to: vacancy.assignedRecruiter.email,
          subject: `[Action Required] Candidate Rejected for ${vacancy.vacancyCode} — Vacancy Reset to ACTIVE`,
          template: 'REPLACEMENT_REQUIRED',
          data: {
            vacancyCode: vacancy.vacancyCode,
            jobTitle: vacancy.title,
            zone: vacancy.zone,
            candidateName: submission.fullName,
            level,
            rejectionReason,
            comments: comments || '',
          },
        });
      }

      res.json({
        success: true,
        message: `Candidate ${submission.fullName} rejected. Feedback logged. Vacancy ${vacancy.vacancyCode} status automatically reset back to ACTIVE in Recruiter's 'Need Attention' Feed.`,
      });
      return;
    }

    // --- CASE B: APPROVAL FLOW ---
    // Log Audit for approval
    await prisma.approvalAudit.create({
      data: {
        submissionId: submission.id,
        level,
        reviewerEmail:
          level === 1
            ? vacancy.approverL1Email || vacancy.project.pmUser?.email || 'pm@recruitment.local'
            : level === 2
            ? vacancy.approverL2Email || vacancy.projectRole?.defaultL2Email || vacancy.project.asmEmail
            : vacancy.approverL3Email || vacancy.projectRole?.defaultL3Email || vacancy.project.rsmEmail,
        action: 'APPROVED',
        comments: comments || null,
      },
    });

    // Check if this level completes all required approval tiers
    if (level >= requiredLevels) {
      // Final Approval -> HIRED / FILLED
      await prisma.candidateSubmission.update({
        where: { id: submission.id },
        data: { status: 'APPROVED' },
      });

      await prisma.vacancy.update({
        where: { id: submission.vacancyId },
        data: { status: 'FILLED' },
      });

      res.json({
        success: true,
        message: `Final Level ${level} Approval completed! Candidate ${submission.fullName} is officially HIRED 🎉. Vacancy ${vacancy.vacancyCode} marked as FILLED.`,
      });
      return;
    }

    // Otherwise, advance to next approval level
    const nextLevel = level + 1;
    await prisma.candidateSubmission.update({
      where: { id: submission.id },
      data: { currentLevel: nextLevel },
    });

    const nextApproverEmail =
      nextLevel === 2
        ? vacancy.approverL2Email || vacancy.projectRole?.defaultL2Email || vacancy.project.asmEmail || 'divya@idonneous.com'
        : vacancy.approverL3Email || vacancy.projectRole?.defaultL3Email || vacancy.project.rsmEmail || 'divya@idonneous.com';

    const nextToken = await generateSingleUseToken(submission.id, nextLevel);
    const checkingId = `APPR-${vacancy.vacancyCode || 'REQ'}-${submission.id.slice(0, 8).toUpperCase()}`;

    await enqueueEmail('approval-escalation-request', {
      to: nextApproverEmail,
      subject: `[Action Required] Checking ID ${checkingId} — Level ${nextLevel} Approval for ${submission.fullName} (${vacancy.vacancyCode})`,
      template: 'APPROVAL_REQUEST',
      data: {
        checkingId,
        level: nextLevel,
        vacancyCode: vacancy.vacancyCode,
        jobTitle: vacancy.title,
        projectName: vacancy.project.name,
        zone: vacancy.zone,
        area: vacancy.area,
        candidateName: submission.fullName,
        candidateEmail: submission.email || 'N/A',
        candidatePhone: submission.phone || 'N/A',
        resumeId: submission.resumeId,
        token: nextToken,
        clientUrl: env.CLIENT_URL,
      },
    });

    res.json({
      success: true,
      message: `Level ${level} Approval recorded (Checking ID: ${checkingId}). Level ${nextLevel} approval email dispatched to ${nextApproverEmail}.`,
      data: {
        checkingId,
        nextLevel,
        nextApproverEmail,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/submissions/trigger-reminders (Automated 48h Reminder & Escalation Check)
submissionsRouter.post('/trigger-reminders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pendingSubmissions = await prisma.candidateSubmission.findMany({
      where: { status: 'PENDING' },
      include: {
        vacancy: {
          include: {
            project: { include: { pmUser: true } },
            projectRole: true,
            assignedRecruiter: true,
          },
        },
      },
    });

    let remindersSent = 0;
    let escalationsTriggered = 0;

    for (const sub of pendingSubmissions) {
      // Find latest token nonce
      const tokenEntry = await prisma.tokenNonce.findFirst({
        where: { submissionId: sub.id, usedAt: null },
        orderBy: { expiresAt: 'desc' },
      });

      if (!tokenEntry) continue;

      const now = new Date();
      // Calculate token age
      const hoursSinceIssue = (now.getTime() - (tokenEntry.lastReminderSentAt?.getTime() || (tokenEntry.expiresAt.getTime() - 72 * 3600 * 1000))) / (1000 * 3600);

      // Attempt 2 Reminder check: Silence for > 48h and reminderCount == 0
      if (hoursSinceIssue >= 48 && tokenEntry.reminderCount === 0) {
        // Generate fresh token
        const freshToken = await generateSingleUseToken(sub.id, tokenEntry.level);

        const approverEmail =
          tokenEntry.level === 1
            ? sub.vacancy.approverL1Email || sub.vacancy.project.pmUser?.email || 'pm@recruitment.local'
            : tokenEntry.level === 2
            ? sub.vacancy.approverL2Email || sub.vacancy.projectRole?.defaultL2Email || sub.vacancy.project.asmEmail
            : sub.vacancy.approverL3Email || sub.vacancy.projectRole?.defaultL3Email || sub.vacancy.project.rsmEmail;

        await enqueueEmail('approval-reminder', {
          to: approverEmail,
          subject: `[Reminder - Attempt 2] Action Required for ${sub.fullName} (${sub.vacancy.vacancyCode})`,
          template: 'APPROVAL_REQUEST',
          data: {
            level: tokenEntry.level,
            vacancyCode: sub.vacancy.vacancyCode,
            candidateName: sub.fullName,
            token: freshToken,
            clientUrl: env.CLIENT_URL,
          },
        });

        await prisma.tokenNonce.update({
          where: { nonce: tokenEntry.nonce },
          data: { reminderCount: 1, lastReminderSentAt: now },
        });

        remindersSent++;
      } else if (tokenEntry.reminderCount >= 1 && !tokenEntry.escalatedAt && hoursSinceIssue >= 48) {
        // Silence after Attempt 2 -> Escalation Alert!
        await prisma.tokenNonce.update({
          where: { nonce: tokenEntry.nonce },
          data: { escalatedAt: now },
        });

        // Alert PM
        const pmEmail = sub.vacancy.project.pmUser?.email || 'pm.unilever@recruitment.local';
        await enqueueEmail('inaction-escalation-pm', {
          to: pmEmail,
          subject: `🚨 [Urgent Escalation] Approver Unresponsive for 4 Days on ${sub.vacancy.vacancyCode}`,
          template: 'APPROVAL_REQUEST',
          data: {
            vacancyCode: sub.vacancy.vacancyCode,
            candidateName: sub.fullName,
            clientUrl: env.CLIENT_URL,
          },
        });

        // Alert Recruiter
        if (sub.vacancy.assignedRecruiter) {
          await enqueueEmail('inaction-escalation-recruiter', {
            to: sub.vacancy.assignedRecruiter.email,
            subject: `⚠️ [Pending Delay] Level ${tokenEntry.level} Approver Unresponsive for 4 Days on ${sub.vacancy.vacancyCode}`,
            template: 'APPROVAL_REQUEST',
            data: {
              vacancyCode: sub.vacancy.vacancyCode,
              candidateName: sub.fullName,
              clientUrl: env.CLIENT_URL,
            },
          });
        }

        escalationsTriggered++;
      }
    }

    res.json({
      success: true,
      message: `Checked ${pendingSubmissions.length} pending submissions. Dispatched ${remindersSent} reminders and ${escalationsTriggered} inaction escalations.`,
      remindersSent,
      escalationsTriggered,
    });
  } catch (err) {
    next(err);
  }
});
