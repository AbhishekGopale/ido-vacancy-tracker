import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().optional(),
  userId: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const identifier = (body.username || body.userId || body.email || '').trim();

    if (!identifier) {
      throw new AppError('User ID or Username is required', 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
        ],
      },
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

    if (!user) {
      throw new AppError('Invalid user ID or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is disabled. Please contact an administrator.', 403);
    }

    const isMatch = await bcrypt.compare(body.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid user ID or password', 401);
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.slug);

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const refreshToken = jwt.sign({ userId: user.id }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    });

    // Record Login Activity & Usage Audit
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'Browser Client';
      await prisma.userLoginAudit.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          roleName: user.role.name,
          action: 'LOGIN',
          ipAddress: clientIp,
          userAgent,
        },
      });
    } catch (auditErr) {
      console.error('Failed to record login audit:', auditErr);
    }

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
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
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
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
      throw new AppError('Invalid refresh token or inactive account', 401);
    }

    const newToken = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    res.json({
      success: true,
      data: {
        token: newToken,
      },
    });
  } catch (err) {
    next(err);
  }
});
