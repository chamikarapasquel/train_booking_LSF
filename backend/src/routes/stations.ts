import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

/**
 * GET /api/stations
 * Returns all stations ordered by their position on the route.
 */
router.get('/', async (_req, res, next) => {
  try {
    const stations = await prisma.station.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true, distanceKm: true },
    });
    res.json({ stations });
  } catch (err) {
    next(err);
  }
});

export default router;
