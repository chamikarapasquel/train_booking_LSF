import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createBooking, cancelBooking, getBookingById } from '../services/bookingService';
import { ValidationError } from '../errors';

const router = Router();

// Input validation schema using Zod
const CreateBookingSchema = z.object({
  seatId:        z.string().min(1, 'seatId is required'),
  fromStationId: z.string().min(1, 'fromStationId is required'),
  toStationId:   z.string().min(1, 'toStationId is required'),
  passengerName: z.string().min(1, 'passengerName is required').max(100),
});

/**
 * POST /api/bookings
 * Creates a new segment booking. Returns 409 if the seat is unavailable.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = CreateBookingSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.errors.map((e) => e.message).join('; '));
    }

    const booking = await createBooking(result.data);
    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bookings/:id
 * Retrieves a booking by its ID (for the confirmation screen).
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await getBookingById(req.params['id'] as string);
    res.json({ booking });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/bookings/:id
 * Soft-cancels a booking, freeing the seat segment for future bookings.
 * Uses soft-delete (status = CANCELLED) to preserve booking history.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await cancelBooking(req.params['id'] as string);
    res.json({ booking });
  } catch (err) {
    next(err);
  }
});

export default router;
