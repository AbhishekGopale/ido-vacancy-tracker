import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const pmOverridesRouter = Router();

pmOverridesRouter.use(requireAuth);

const vacancyActionSchema = z.object({
  vacancyId: z.string().uuid(),
  reason: z.string().optional(),
});

// POST /api/v1/overrides/cancel (PM Eliminate / Cancel Requisition)
pmOverridesRouter.post('/cancel', requirePermission('vacancies.override'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vacancyId, reason } = vacancyActionSchema.parse(req.body);

    const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
    if (!vacancy) throw new AppError('Vacancy not found', 404);

    const updated = await prisma.vacancy.update({
      where: { id: vacancyId },
      data: { status: 'CANCELLED' },
    });

    res.json({
      success: true,
      message: `Master PM Override: Vacancy ${vacancy.vacancyCode || vacancy.title} has been CANCELLED.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/overrides/force-fill (PM Force Complete / Mark Filled)
pmOverridesRouter.post('/force-fill', requirePermission('vacancies.override'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vacancyId, reason } = vacancyActionSchema.parse(req.body);

    const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
    if (!vacancy) throw new AppError('Vacancy not found', 404);

    const updated = await prisma.vacancy.update({
      where: { id: vacancyId },
      data: { status: 'FILLED' },
    });

    res.json({
      success: true,
      message: `Master PM Override: Vacancy ${vacancy.vacancyCode || vacancy.title} force-marked as FILLED.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/overrides/:vacancyId (PM Delete Requisition)
pmOverridesRouter.delete('/:vacancyId', requirePermission('vacancies.override'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vacancyId } = req.params;

    await prisma.vacancy.delete({ where: { id: vacancyId } });

    res.json({
      success: true,
      message: 'Master PM Override: Vacancy permanently deleted.',
    });
  } catch (err) {
    next(err);
  }
});
