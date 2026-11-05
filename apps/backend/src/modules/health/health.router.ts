import { Router, Request, Response } from 'express';
import { prisma } from '../../config/db.js';
import { redis } from '../../config/redis.js';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  let dbHealthy = true;
  let redisHealthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbHealthy = false;
  }

  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      redisHealthy = false;
    }
  } catch (err) {
    redisHealthy = false;
  }

  const isHealthy = dbHealthy;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      database: dbHealthy ? 'connected' : 'error',
      redis: redisHealthy ? 'connected' : 'offline_fallback',
    },
  });
});
