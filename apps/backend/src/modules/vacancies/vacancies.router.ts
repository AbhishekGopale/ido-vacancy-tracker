import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const vacanciesRouter = Router();

export const OFFICIAL_10_ZONES = [
  'West Mumbai',
  'West ROM',
  'West Gujarat',
  'South AP',
  'South KN',
  'South TG',
  'South TN',
  'East',
  'North Delhi',
  'North Punjab',
] as const;

// GET /api/v1/vacancies/csv-template (Download Sample CSV Template with Zone, City, Area, Location Name, MT/GT)
vacanciesRouter.get('/csv-template', (req: Request, res: Response) => {
  const csvHeaders = 'Project_Code,Zone,City,Area,Location_Name,Store_Type,Vacancy_Type,Positions_Count,Job_Title,Store_Code,Store_Chain,Salary,Experience,Target_Days_To_Fill,Approver_L1_Email,Approver_L2_Email,Approver_L3_Email\n';
  const sampleRow1 = 'UI,West Mumbai,Mumbai,Kandivali West,Dmart Mahavir Nagar,MT,REGULAR,1,Beverage Brand Promoter,DM-MHV-01,DMART,"₹25,000 - ₹35,000 / month",1-2 Years,2,pm.unilever@recruitment.local,chicago.asm@company.com,\n';
  const sampleRow2 = 'UI,North Delhi,Delhi,Connaught Place,Reliance Smart Plaza,MT,REGULAR,2,Retail Merchandiser,REL-CP-01,RELIANCE,"₹22,000 - ₹30,000 / month",Entry Level,2,pm.unilever@recruitment.local,delhi.asm@company.com,\n';
  const sampleRow3 = 'PG,South KN,Bengaluru,Koramangala,Gupta Super Store,GT,TACT,1,Store Promoter,,,GENERAL,"₹20,000 - ₹28,000 / month",1+ Years,3,pm.pg@recruitment.local,blr.asm@company.com,south.rsm@company.com\n';

  const csvContent = csvHeaders + sampleRow1 + sampleRow2 + sampleRow3;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sample_vacancy_upload_template.csv"');
  res.status(200).send(csvContent);
});

vacanciesRouter.use(requireAuth);

const emptyStringToNull = (val: any) => (typeof val === 'string' && val.trim() === '' ? null : val);

const ingestSingleSchema = z.object({
  projectId: z.string().uuid(),
  projectRoleId: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  storeId: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  title: z.string().min(2),
  zone: z.string().min(2),
  area: z.string().min(2),
  line: z.preprocess(emptyStringToNull, z.string().optional().nullable()),
  tradeType: z.string().optional().default('MT'),
  manpowerType: z.string().optional().default('REGULAR'),
  requiredPositions: z.preprocess((val) => (val ? Number(val) : 1), z.number().int().positive().optional().default(1)),
  salary: z.string().optional(),
  experience: z.string().optional(),
  targetDaysToFill: z.preprocess((val) => (val ? Number(val) : 2), z.number().int().positive().optional().default(2)),
  approverL1Email: z.preprocess(emptyStringToNull, z.string().email('Invalid Level 1 Email').optional().nullable()),
  approverL2Email: z.preprocess(emptyStringToNull, z.string().email('Invalid Level 2 Email').optional().nullable()),
  approverL3Email: z.preprocess(emptyStringToNull, z.string().email('Invalid Level 3 Email').optional().nullable()),
  assignedRecruiterId: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
});

const bulkCsvRowSchema = z.object({
  projectCode: z.string().min(1),
  title: z.string().min(1),
  zone: z.string().min(1),
  area: z.string().min(1),
  salary: z.string().optional(),
  experience: z.string().optional(),
  targetDaysToFill: z.preprocess((val) => (val ? Number(val) : 2), z.number().int().positive()).optional(),
  approverL1Email: z.preprocess(emptyStringToNull, z.string().email().optional().nullable()),
  approverL2Email: z.preprocess(emptyStringToNull, z.string().email().optional().nullable()),
  approverL3Email: z.preprocess(emptyStringToNull, z.string().email().optional().nullable()),
});

const ingestDecisionSchema = z.object({
  vacancyId: z.string().uuid(),
  decision: z.enum(['SAME', 'DIFFERENT_APPROVE']),
});

// GET /api/v1/vacancies
vacanciesRouter.get('/', requirePermission('vacancies.read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zone, area, status, projectId, assignedRecruiterId, urgency, sort } = req.query;
    const where: any = {};

    // Role-based scoping
    if (req.user?.roleName === 'RECRUITER' && req.user.id) {
      const recUser = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (recUser?.area) {
        where.OR = [
          { assignedRecruiterId: recUser.id },
          { area: recUser.area },
        ];
      } else if (recUser?.zone) {
        where.zone = recUser.zone;
      }
    } else if (req.user?.roleName === 'PM' && req.user.id) {
      // PM Scoping: Only see vacancies under projects assigned to this PM
      where.project = {
        OR: [
          { pmUserId: req.user.id },
          { projectAssignments: { some: { userId: req.user.id } } },
        ],
      };
      if (zone && typeof zone === 'string' && zone !== 'ALL') {
        where.zone = zone;
      }
      if (area && typeof area === 'string' && area !== 'ALL') {
        where.area = area;
      }
    } else {
      if (zone && typeof zone === 'string' && zone !== 'ALL') where.zone = zone;
      if (area && typeof area === 'string' && area !== 'ALL') where.area = area;
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') where.projectId = projectId;
    if (assignedRecruiterId && typeof assignedRecruiterId === 'string') where.assignedRecruiterId = assignedRecruiterId;

    // Urgency / SLA filter
    const now = new Date();
    if (urgency === 'OVERDUE') {
      where.targetDueDate = { lt: now };
    } else if (urgency === 'DUE_SOON') {
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      where.targetDueDate = { gte: now, lte: in48Hours };
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'oldest') orderBy = { createdAt: 'asc' };
    else if (sort === 'due_soonest') orderBy = { targetDueDate: 'asc' };

    const vacancies = await prisma.vacancy.findMany({
      where,
      include: {
        store: true,
        project: { include: { pmUser: true } },
        projectRole: { include: { baseRole: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedRecruiter: { select: { id: true, username: true, firstName: true, lastName: true, email: true, zone: true, area: true } },
        submissions: {
          orderBy: { createdAt: 'desc' },
          include: { audits: { orderBy: { createdAt: 'asc' } } },
        },
      },
      orderBy,
    });

    res.json({ success: true, data: vacancies });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vacancies/:id
vacanciesRouter.get('/:id', requirePermission('vacancies.read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const vacancy = await prisma.vacancy.findUnique({
      where: { id },
      include: {
        store: true,
        project: { include: { pmUser: true } },
        projectRole: { include: { baseRole: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedRecruiter: { select: { id: true, username: true, firstName: true, lastName: true, email: true, zone: true, area: true } },
        submissions: { include: { audits: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!vacancy) throw new AppError('Vacancy not found', 404);

    res.json({ success: true, data: vacancy });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vacancies/single (Ingest Single Vacancy -> enters PENDING_INGEST_REVIEW)
vacanciesRouter.post('/single', requirePermission('vacancies.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = ingestSingleSchema.parse(req.body);

    // PM Scoping Guard: PM can only ingest vacancies for projects assigned to them
    if (req.user?.roleName === 'PM') {
      const isAssigned = await prisma.project.findFirst({
        where: {
          id: data.projectId,
          OR: [
            { pmUserId: req.user.id },
            { projectAssignments: { some: { userId: req.user.id } } },
          ],
        },
      });
      if (!isAssigned) {
        throw new AppError('Unauthorized: You are only permitted to ingest vacancies for projects assigned to your account.', 403);
      }
    }

    // Composite key check: [ Project_ID ] + [ Job_Title ] + [ Zone ] + [ Area ]
    const existingMatch = await prisma.vacancy.findFirst({
      where: {
        projectId: data.projectId,
        title: { equals: data.title },
        zone: { equals: data.zone },
        area: { equals: data.area },
        status: { in: ['ACTIVE', 'PENDING_APPROVAL', 'FILLED'] },
      },
    });

    const isDuplicate = !!existingMatch;

    // Auto-assign Area Recruiter (1-to-1 Area binding), fallback to Zone
    let assignedRecruiterId = data.assignedRecruiterId;
    if (!assignedRecruiterId) {
      const areaRecruiter = await prisma.user.findFirst({
        where: { role: { name: 'RECRUITER' }, area: { equals: data.area }, isActive: true },
      });
      if (areaRecruiter) {
        assignedRecruiterId = areaRecruiter.id;
      } else {
        const zoneRecruiter = await prisma.user.findFirst({
          where: { role: { name: 'RECRUITER' }, zone: { equals: data.zone }, isActive: true },
        });
        if (zoneRecruiter) assignedRecruiterId = zoneRecruiter.id;
      }
    }

    // Role SLA defaults & Approver fallbacks
    let projectRole = null;
    if (data.projectRoleId) {
      projectRole = await prisma.projectRole.findUnique({ where: { id: data.projectRoleId } });
    }

    const targetDays = data.targetDaysToFill || projectRole?.targetDaysToFill || 2;
    const targetDueDate = new Date(Date.now() + targetDays * 24 * 60 * 60 * 1000);

    const approverL1 = data.approverL1Email || projectRole?.defaultL1Email || null;
    const approverL2 = data.approverL2Email || projectRole?.defaultL2Email || projectRole?.asmEmail || null;
    const approverL3 = data.approverL3Email || projectRole?.defaultL3Email || projectRole?.rsmEmail || null;

    const vacancy = await prisma.vacancy.create({
      data: {
        projectId: data.projectId,
        projectRoleId: data.projectRoleId || null,
        storeId: data.storeId || null,
        title: data.title,
        zone: data.zone,
        area: data.area,
        line: data.line || null,
        tradeType: data.tradeType || 'MT',
        manpowerType: data.manpowerType || 'REGULAR',
        requiredPositions: data.requiredPositions || 1,
        salary: data.salary || null,
        experience: data.experience || null,
        targetDaysToFill: targetDays,
        targetDueDate,
        approverL1Email: approverL1,
        approverL2Email: approverL2,
        approverL3Email: approverL3,
        status: isDuplicate ? 'DRAFT_DUPLICATE_FLAG' : 'PENDING_INGEST_REVIEW',
        vacancyCode: null, // Non-editable ID assigned upon PM activation
        createdById: req.user!.id,
        assignedRecruiterId: assignedRecruiterId || null,
      },
      include: { project: true, projectRole: true, store: true },
    });

    res.status(201).json({
      success: true,
      isDuplicateFlagged: isDuplicate,
      message: isDuplicate
        ? `Composite match detected for [${data.title} - ${data.zone} - ${data.area}]. Flagged for PM Review.`
        : `Vacancy ingested successfully with ${targetDays}-day SLA target. Placed in PM Ingest Queue.`,
      data: vacancy,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vacancies/bulk-csv (Bulk CSV Upload with Store Linking & Error Sheet Collection)
vacanciesRouter.post('/bulk-csv', requirePermission('vacancies.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new AppError('No valid CSV rows provided for bulk ingestion.', 400);
    }

    // PM Scoping Guard: Collect allowed project codes for PM
    let allowedCodes: Set<string> | null = null;
    let pmAssignedList = '';
    if (req.user?.roleName === 'PM') {
      const pmProjects = await prisma.project.findMany({
        where: {
          OR: [
            { pmUserId: req.user.id },
            { projectAssignments: { some: { userId: req.user.id } } },
          ],
        },
        select: { code: true },
      });
      allowedCodes = new Set(pmProjects.map((p) => p.code.trim().toUpperCase()));
      pmAssignedList = Array.from(allowedCodes).join(', ') || 'None';
    }

    const createdVacancies = [];
    const errorRows: Array<{
      rowNumber: number;
      projectCode: string;
      zone: string;
      city: string;
      area: string;
      locationName: string;
      storeType: string;
      jobTitle: string;
      errorReason: string;
      raw: any;
    }> = [];
    let duplicateCount = 0;

    let rowIndex = 1;
    for (const rawRow of rows) {
      rowIndex++;
      const pCode = (rawRow.projectCode || rawRow.Project_Code || '').toString().trim().toUpperCase();
      const zName = (rawRow.zone || rawRow.Zone || '').toString().trim();
      const locName = (rawRow.locationName || rawRow.Location_Name || rawRow.storeName || rawRow.Store_Name || '').toString().trim();
      const sType = (rawRow.storeType || rawRow.Store_Type || rawRow.tradeType || rawRow.Trade_Type || '').toString().trim().toUpperCase();
      const jTitle = (rawRow.title || rawRow.jobTitle || rawRow.Job_Title || '').toString().trim();
      const city = (rawRow.city || rawRow.City || '').toString().trim();
      const area = (rawRow.area || rawRow.Area || '').toString().trim();

      // 1. Check Project Code
      if (!pCode) {
        errorRows.push({ rowNumber: rowIndex, projectCode: pCode, zone: zName, city, area, locationName: locName, storeType: sType, jobTitle: jTitle, errorReason: 'Missing Project Code', raw: rawRow });
        continue;
      }

      // 2. Check PM Authorization
      if (allowedCodes && !allowedCodes.has(pCode)) {
        errorRows.push({ rowNumber: rowIndex, projectCode: pCode, zone: zName, city, area, locationName: locName, storeType: sType, jobTitle: jTitle, errorReason: `Unauthorized: As Project Manager you can only upload for your assigned project(s) [${pmAssignedList}]`, raw: rawRow });
        continue;
      }

      // 3. Find Project in DB
      const project = await prisma.project.findUnique({ where: { code: pCode } });
      if (!project) {
        errorRows.push({ rowNumber: rowIndex, projectCode: pCode, zone: zName, city, area, locationName: locName, storeType: sType, jobTitle: jTitle, errorReason: `Project code '${pCode}' not found in database`, raw: rawRow });
        continue;
      }

      // 4. Validate Zone against the 10 Official Zones
      const matchedZone = OFFICIAL_10_ZONES.find((oz) => oz.toLowerCase() === zName.toLowerCase());
      if (!matchedZone) {
        errorRows.push({ rowNumber: rowIndex, projectCode: pCode, zone: zName, city, area, locationName: locName, storeType: sType, jobTitle: jTitle, errorReason: `Invalid Zone '${zName}'. Must be one of the 10 official Zones: ${OFFICIAL_10_ZONES.join(', ')}`, raw: rawRow });
        continue;
      }

      // 5. Compulsory Store_Type check (Must be MT or GT)
      if (sType !== 'MT' && sType !== 'GT') {
        errorRows.push({ rowNumber: rowIndex, projectCode: pCode, zone: matchedZone, city, area, locationName: locName, storeType: sType, jobTitle: jTitle, errorReason: `Missing or invalid Store_Type '${sType}'. Must be compulsory 'MT' (Modern Trade) or 'GT' (General Trade)`, raw: rawRow });
        continue;
      }

      // 6. Check Location Name (Store Name)
      if (!locName) {
        errorRows.push({ rowNumber: rowIndex, projectCode: pCode, zone: matchedZone, city, area, locationName: locName, storeType: sType, jobTitle: jTitle, errorReason: 'Missing Location_Name / Store Name', raw: rawRow });
        continue;
      }

      // 7. Check Job Title
      if (!jTitle) {
        errorRows.push({ rowNumber: rowIndex, projectCode: pCode, zone: matchedZone, city, area, locationName: locName, storeType: sType, jobTitle: jTitle, errorReason: 'Missing Job_Title / Position Role', raw: rawRow });
        continue;
      }

      // Store Code: optional. If missing, auto-generate unique slug
      let sCode = (rawRow.storeCode || rawRow.Store_Code || '').toString().trim().toUpperCase();
      if (!sCode) {
        const cleanLoc = locName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'LOC';
        const cleanZn = matchedZone.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
        sCode = `${cleanZn}-${cleanLoc}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const rawChain = (rawRow.storeChain || rawRow.Store_Chain || '').toString().trim().toUpperCase();
      const sChain = rawChain || (sType === 'MT' ? 'MODERN_TRADE' : 'GENERAL_TRADE');
      const rawVType = (rawRow.vacancyType || rawRow.Vacancy_Type || '').toString().trim().toUpperCase();
      const vType = rawVType === 'TACT' ? 'TACT' : 'REGULAR';
      const rawPos = rawRow.positionsCount || rawRow.Positions_Count || rawRow.requiredPositions;
      const reqPos = Number(rawPos) > 0 ? Math.floor(Number(rawPos)) : 1;

      // Upsert Store in Database
      let store = await prisma.store.findFirst({
        where: {
          OR: [
            { code: sCode },
            { name: { equals: locName }, zone: matchedZone },
          ],
        },
      });

      if (!store) {
        store = await prisma.store.create({
          data: {
            code: sCode,
            name: locName,
            chain: sChain,
            tradeType: sType,
            zone: matchedZone,
            area: area || locName,
            city: city || null,
          },
        });
      }

      // Recruiter auto-assign 1-to-1 by Zone
      const designatedRecruiter = await prisma.user.findFirst({
        where: {
          role: { name: 'RECRUITER' },
          OR: [
            { zone: { equals: matchedZone } },
            { area: { equals: matchedZone } },
          ],
          isActive: true,
        },
      });

      // Duplicate Check (same store and project with active requisition)
      const existingMatch = await prisma.vacancy.findFirst({
        where: {
          projectId: project.id,
          storeId: store.id,
          title: { equals: jTitle },
          status: { in: ['ACTIVE', 'PENDING_APPROVAL', 'FILLED', 'ON_HOLD'] },
        },
      });

      const isDuplicate = !!existingMatch;
      if (isDuplicate) duplicateCount++;

      const targetDays = Number(rawRow.targetDaysToFill || rawRow.Target_Days_To_Fill) > 0 ? Number(rawRow.targetDaysToFill || rawRow.Target_Days_To_Fill) : 2;
      const targetDueDate = new Date(Date.now() + targetDays * 24 * 60 * 60 * 1000);

      const vac = await prisma.vacancy.create({
        data: {
          projectId: project.id,
          storeId: store.id,
          title: jTitle,
          zone: matchedZone,
          area: area || matchedZone,
          tradeType: sType,
          manpowerType: vType,
          requiredPositions: reqPos,
          filledPositions: 0,
          salary: (rawRow.salary || rawRow.Salary) ? (rawRow.salary || rawRow.Salary).toString().trim() : null,
          experience: (rawRow.experience || rawRow.Experience) ? (rawRow.experience || rawRow.Experience).toString().trim() : null,
          targetDaysToFill: targetDays,
          targetDueDate,
          approverL1Email: (rawRow.approverL1Email || rawRow.Approver_L1_Email) ? (rawRow.approverL1Email || rawRow.Approver_L1_Email).toString().trim() : null,
          approverL2Email: (rawRow.approverL2Email || rawRow.Approver_L2_Email) ? (rawRow.approverL2Email || rawRow.Approver_L2_Email).toString().trim() : project.asmEmail,
          approverL3Email: (rawRow.approverL3Email || rawRow.Approver_L3_Email) ? (rawRow.approverL3Email || rawRow.Approver_L3_Email).toString().trim() : project.rsmEmail,
          status: isDuplicate ? 'DRAFT_DUPLICATE_FLAG' : 'PENDING_INGEST_REVIEW',
          vacancyCode: null,
          createdById: req.user!.id,
          assignedRecruiterId: designatedRecruiter ? designatedRecruiter.id : null,
        },
      });
      createdVacancies.push(vac);
    }

    res.status(201).json({
      success: createdVacancies.length > 0 || errorRows.length === 0,
      message: `Bulk Ingestion Processed: ${createdVacancies.length} created (${duplicateCount} duplicate matches flagged), ${errorRows.length} errors.`,
      count: createdVacancies.length,
      duplicateCount,
      errorCount: errorRows.length,
      errorRows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vacancies/ingest-decision (PM Ingest & Deduplication Queue Decision)
vacanciesRouter.post('/ingest-decision', requirePermission('vacancies.dedup_decision'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vacancyId, decision } = ingestDecisionSchema.parse(req.body);

    const vac = await prisma.vacancy.findUnique({
      where: { id: vacancyId },
      include: { project: true },
    });

    if (!vac || (vac.status !== 'PENDING_INGEST_REVIEW' && vac.status !== 'DRAFT_DUPLICATE_FLAG')) {
      throw new AppError('Vacancy is not currently pending PM ingest review.', 400);
    }

    if (decision === 'SAME') {
      // Delete entry without consuming Auto-ID sequence
      await prisma.vacancy.delete({ where: { id: vacancyId } });
      res.json({
        success: true,
        message: 'Duplicate record permanently deleted. Auto Vacancy ID sequence preserved.',
      });
      return;
    }

    // DIFFERENT & APPROVE: Atomic transaction generating non-editable code (e.g. UI003), flipping status to ACTIVE
    const updated = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({ where: { id: vac.projectId } });
      if (!project) throw new AppError('Project template not found', 400);

      // Scan all existing vacancy codes for this project prefix to guarantee zero collisions
      const existingProjectVacancies = await tx.vacancy.findMany({
        where: {
          projectId: project.id,
          vacancyCode: { not: null },
        },
        select: { vacancyCode: true },
      });

      let highestSeq = project.currentSeq || 0;
      for (const ev of existingProjectVacancies) {
        if (ev.vacancyCode && ev.vacancyCode.startsWith(project.code)) {
          const numPart = parseInt(ev.vacancyCode.slice(project.code.length), 10);
          if (!isNaN(numPart) && numPart > highestSeq) {
            highestSeq = numPart;
          }
        }
      }

      const nextSeq = highestSeq + 1;
      const code = `${project.code}${String(nextSeq).padStart(3, '0')}`;

      await tx.project.update({
        where: { id: project.id },
        data: { currentSeq: nextSeq },
      });

      let assignedRecruiterId = vac.assignedRecruiterId;
      if (!assignedRecruiterId) {
        const zoneRec = await tx.user.findFirst({
          where: { role: { name: 'RECRUITER' }, zone: { equals: vac.zone }, isActive: true },
        });
        if (zoneRec) assignedRecruiterId = zoneRec.id;
      }

      return tx.vacancy.update({
        where: { id: vacancyId },
        data: {
          vacancyCode: code,
          status: 'ACTIVE',
          assignedRecruiterId,
        },
        include: { project: true, assignedRecruiter: true },
      });
    });

    res.json({
      success: true,
      message: `Vacancy approved & activated with Auto Vacancy ID ${updated.vacancyCode}! Routed to Zone ${updated.zone} Recruiter.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/vacancies/:id/hold (PM/Admin Hold & Un-hold Requisitions)
vacanciesRouter.patch('/:id/hold', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { onHold, holdReason } = req.body;

    const allowedRoles = ['PM', 'SUPER_MANAGER', 'ADMIN', 'OWNER'];
    if (!allowedRoles.includes(req.user?.roleName || '')) {
      throw new AppError('Unauthorized: Only Project Managers or Administrators can modify hold status.', 403);
    }

    const vacancy = await prisma.vacancy.findUnique({ where: { id } });
    if (!vacancy) throw new AppError('Vacancy not found', 404);

    const updated = await prisma.vacancy.update({
      where: { id },
      data: {
        status: onHold ? 'ON_HOLD' : 'ACTIVE',
        holdReason: onHold ? (holdReason || 'Put on hold by Project Manager') : null,
        holdSetById: onHold ? req.user?.id : null,
        holdSetAt: onHold ? new Date() : null,
      },
      include: {
        project: true,
        store: true,
        submissions: true,
      },
    });

    res.json({
      success: true,
      message: onHold ? `Requisition placed on hold: ${updated.holdReason}` : 'Requisition restored to active status.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});
