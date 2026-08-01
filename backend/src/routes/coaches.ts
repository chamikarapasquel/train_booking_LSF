import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

/**
 * GET /api/coaches
 * Returns all coaches with their type and capacity.
 */
router.get('/', async (_req, res, next) => {
  try {
    const coaches = await prisma.coach.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, capacity: true },
    });
    res.json({ coaches });
  } catch (err) {
    next(err);
  }
});

export default router;
