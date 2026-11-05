import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { requireAuth } from '../../middleware/auth.js';

export const rolesRouter = Router();

rolesRouter.use(requireAuth);

// GET /api/v1/roles
rolesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    const formatted = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions.map((rp) => rp.permission.slug),
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/roles/permissions
rolesRouter.get('/permissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { slug: 'asc' },
    });
    res.json({ success: true, data: permissions });
  } catch (err) {
    next(err);
  }
});
