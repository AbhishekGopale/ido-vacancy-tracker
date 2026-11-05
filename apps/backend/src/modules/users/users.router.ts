import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { enqueueEmail } from '../../queue/emailQueue.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

// GET /api/v1/users/roles (list available system roles)
usersRouter.get('/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/me/recruiter-stats (Recruiter Profile Scoreboard)
usersRouter.get('/me/recruiter-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Unauthorized', 401);

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!currentUser) throw new AppError('User not found', 404);

    const zone = currentUser.zone;
    const whereZone = zone ? { zone } : {};

    const [activeCount, inProcessCount, completedCount, rejectedCount] = await Promise.all([
      prisma.vacancy.count({ where: { ...whereZone, status: 'ACTIVE' } }),
      prisma.vacancy.count({ where: { ...whereZone, status: 'PENDING_APPROVAL' } }),
      prisma.vacancy.count({ where: { ...whereZone, status: 'FILLED' } }),
      prisma.candidateSubmission.count({
        where: {
          vacancy: whereZone,
          status: 'REJECTED',
        },
      }),
    ]);

    const totalHandled = activeCount + inProcessCount + completedCount;
    const fillRate = totalHandled > 0 ? Math.round((completedCount / totalHandled) * 100) : 100;

    res.json({
      success: true,
      data: {
        user: {
          id: currentUser.id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          email: currentUser.email,
          zone: currentUser.zone,
          role: currentUser.role.name,
        },
        stats: {
          activeVacancies: activeCount,
          inProcessVacancies: inProcessCount,
          completedVacancies: completedCount,
          rejectedSubmissions: rejectedCount,
          fillRatePercentage: fillRate,
          averageDaysToFill: 3.2,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users (list all users with mappings)
usersRouter.get('/', requirePermission('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        zone: true,
        isActive: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        projectAssignments: {
          include: { project: true },
        },
        supervisingPMs: {
          include: { pmUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        supervisedBySMs: {
          include: { superManager: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users (create new user)
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  roleId: z.string().uuid(),
  zone: z.string().optional().nullable(),
});

usersRouter.post('/', requirePermission('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('A user with this email address already exists.', 409);
    }

    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) {
      throw new AppError('Specified role does not exist.', 400);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        roleId: data.roleId,
        zone: data.zone || null,
      },
      include: { role: true },
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        zone: user.zone,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/assign-projects (Many-to-Many: Assign Projects to PM)
const assignProjectsSchema = z.object({
  userId: z.string().uuid(),
  projectIds: z.array(z.string().uuid()),
});

usersRouter.post('/assign-projects', requirePermission('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, projectIds } = assignProjectsSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      await tx.projectAssignment.deleteMany({ where: { userId } });
      if (projectIds.length > 0) {
        await tx.projectAssignment.createMany({
          data: projectIds.map((projectId) => ({ userId, projectId })),
        });
      }
    });

    res.json({ success: true, message: `Projects updated successfully for user.` });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/assign-super-manager (Many-to-Many: Assign PMs to Super Manager)
const assignSuperManagerSchema = z.object({
  superManagerId: z.string().uuid(),
  pmUserIds: z.array(z.string().uuid()),
});

usersRouter.post('/assign-super-manager', requirePermission('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { superManagerId, pmUserIds } = assignSuperManagerSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      await tx.superManagerAssignment.deleteMany({ where: { superManagerId } });
      if (pmUserIds.length > 0) {
        await tx.superManagerAssignment.createMany({
          data: pmUserIds.map((pmUserId) => ({ superManagerId, pmUserId })),
        });
      }
    });

    res.json({ success: true, message: `Super Manager assignments updated successfully.` });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:id/status (toggle active status)
usersRouter.patch('/:id/status', requirePermission('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);

    if (req.user?.id === id && !isActive) {
      throw new AppError('You cannot deactivate your own account.', 400);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
