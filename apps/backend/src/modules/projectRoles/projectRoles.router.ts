import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const projectRolesRouter = Router();

projectRolesRouter.use(requireAuth);

const emptyToNull = (val: any) => (typeof val === 'string' && val.trim() === '' ? null : val);

const createProjectRoleSchema = z.object({
  projectId: z.string().uuid(),
  baseRoleId: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
  title: z.string().min(2, 'Job Title must be at least 2 characters'),
  salary: z.string().optional(),
  experience: z.string().optional(),
  description: z.string().optional(),
  targetDaysToFill: z.preprocess((val) => (val ? Number(val) : 2), z.number().int().positive().optional().default(2)),
  approvalLevelsCount: z.preprocess(
    (val) => (val !== undefined && val !== null ? Number(val) : 2),
    z.number().int().min(0, 'Approval Tiers must be 0, 1, 2, or 3').max(3, 'Max 3 approval tiers').optional().default(2)
  ),
  defaultL1Email: z.preprocess(emptyToNull, z.string().email('Invalid Level 1 email address').nullable().optional()),
  defaultL2Email: z.preprocess(emptyToNull, z.string().email('Invalid Level 2 email address').nullable().optional()),
  defaultL3Email: z.preprocess(emptyToNull, z.string().email('Invalid Level 3 email address').nullable().optional()),
  asmEmail: z.preprocess(emptyToNull, z.string().email('Invalid ASM email address').nullable().optional()),
  rsmEmail: z.preprocess(emptyToNull, z.string().email('Invalid RSM email address').nullable().optional()),
});

// GET /api/v1/project-roles/base-roles (List system base roles)
projectRolesRouter.get('/base-roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const baseRoles = await prisma.baseRole.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: baseRoles });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/project-roles (List project role configurations)
projectRolesRouter.get('/', requirePermission('vacancies.read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (req.user?.roleName === 'PM' && req.user.id) {
      where.project = {
        OR: [
          { pmUserId: req.user.id },
          { projectAssignments: { some: { userId: req.user.id } } },
        ],
      };
    }
    if (projectId && typeof projectId === 'string') where.projectId = projectId;

    const projectRoles = await prisma.projectRole.findMany({
      where,
      include: {
        project: true,
        baseRole: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: projectRoles });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/project-roles (PM Step 1 Setup: Configure dynamic project role)
projectRolesRouter.post('/', requirePermission('project_roles.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createProjectRoleSchema.parse(req.body);

    if (req.user?.roleName === 'PM') {
      const allowed = await prisma.project.findFirst({
        where: {
          id: data.projectId,
          OR: [
            { pmUserId: req.user.id },
            { projectAssignments: { some: { userId: req.user.id } } },
          ],
        },
      });
      if (!allowed) {
        throw new AppError('Unauthorized: You can only configure roles for projects assigned to your account.', 403);
      }
    }

    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) throw new AppError('Project template not found', 400);

    const projectRole = await prisma.projectRole.create({
      data: {
        projectId: data.projectId,
        baseRoleId: data.baseRoleId || null,
        title: data.title,
        salary: data.salary || null,
        experience: data.experience || null,
        description: data.description || null,
        targetDaysToFill: data.targetDaysToFill ?? 2,
        approvalLevelsCount: data.approvalLevelsCount !== undefined ? data.approvalLevelsCount : 2,
        defaultL1Email: data.approvalLevelsCount === 0 ? null : (data.defaultL1Email || (req.user ? req.user.email : null)),
        defaultL2Email: data.approvalLevelsCount === 0 ? null : (data.defaultL2Email || data.asmEmail || project.asmEmail || 'divya@idonneous.com'),
        defaultL3Email: data.approvalLevelsCount <= 2 ? null : (data.defaultL3Email || data.rsmEmail || project.rsmEmail || 'divya@idonneous.com'),
        asmEmail: data.defaultL2Email || data.asmEmail || project.asmEmail || 'divya@idonneous.com',
        rsmEmail: data.defaultL3Email || data.rsmEmail || project.rsmEmail || 'divya@idonneous.com',
      },
      include: { project: true, baseRole: true },
    });

    res.status(201).json({
      success: true,
      message: `Dynamic Project Role "${projectRole.title}" configured with ${projectRole.targetDaysToFill}-day fill target for ${project.name}.`,
      data: projectRole,
    });
  } catch (err) {
    next(err);
  }
});
