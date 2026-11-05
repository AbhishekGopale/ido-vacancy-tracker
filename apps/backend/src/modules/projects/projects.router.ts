import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { requireAuth } from '../../middleware/auth.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

// GET /api/v1/projects
projectsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.user?.roleName === 'PM' && req.user.id) {
      where.OR = [
        { pmUserId: req.user.id },
        { projectAssignments: { some: { userId: req.user.id } } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        pmUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        projectAssignments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
});
