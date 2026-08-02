import { Router, Request, Response, NextFunction } from 'express';
import { getSeatAvailability } from '../services/availabilityService';
import { ValidationError } from '../errors';

const router = Router();

/**
 * GET /api/seats/availability
 *
 * Returns all reserved-coach seats annotated with availability for the
 * requested leg. The frontend uses this to render the seat map.
 */
router.get('/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromStationId, toStationId } = req.query;

    if (!fromStationId || typeof fromStationId !== 'string') {
      throw new ValidationError('Query parameter "fromStationId" is required');
    }
    if (!toStationId || typeof toStationId !== 'string') {
      throw new ValidationError('Query parameter "toStationId" is required');
    }

    const seats = await getSeatAvailability(fromStationId, toStationId);
    res.json({ seats });
  } catch (err) {
    next(err);
  }
});

export default router;
