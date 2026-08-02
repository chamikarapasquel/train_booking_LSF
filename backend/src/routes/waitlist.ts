import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { joinWaitlist, getWaitlistEntry, cancelWaitlistEntry } from '../services/waitlistService';
import { ValidationError } from '../errors';

const router = Router();

const JoinWaitlistSchema = z.object({
  fromStationId: z.string().min(1, 'fromStationId is required'),
  toStationId:   z.string().min(1, 'toStationId is required'),
  passengerName: z.string().min(1, 'passengerName is required').max(100),
});

/**
 * POST /api/waitlist
 * Joins the waitlist for a fully-booked segment.
 * Returns 201 with the created WaitlistEntry.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = JoinWaitlistSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.errors.map((e) => e.message).join('; '));
    }
    const entry = await joinWaitlist(result.data);
    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/waitlist/:id
 * Polls the status of a waitlist entry. Returns position and whether promoted.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await getWaitlistEntry(req.params['id'] as string);
    res.json({ entry });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/waitlist/:id
 * Passenger withdraws their waitlist entry.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await cancelWaitlistEntry(req.params['id'] as string);
    res.json({ entry });
  } catch (err) {
    next(err);
  }
});

export default router;
