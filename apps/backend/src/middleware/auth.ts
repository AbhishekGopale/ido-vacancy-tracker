import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';

export interface AuthUser {
  id: string;
  username?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  zone?: string | null;
  area?: string | null;
  phone?: string | null;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication required. Missing or malformed token.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'Invalid token or account is deactivated.' });
      return;
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.slug);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.role.id,
      roleName: user.role.name,
      zone: user.zone,
      area: user.area,
      phone: user.phone,
      permissions,
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      return;
    }
    res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Super Admin has unrestricted access
    if (req.user.roleName === 'SUPER_ADMIN') {
      return next();
    }

    const hasAll = requiredPermissions.every((perm) => req.user!.permissions.includes(perm));

    if (!hasAll) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Missing required permission: ${requiredPermissions.join(', ')}`,
      });
      return;
    }

    next();
  };
}
