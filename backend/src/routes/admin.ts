import { Router } from 'express';
import { prisma } from '../db';
import { AppError } from '../errors';

const router = Router();

router.get('/stats', async (req, res, next) => {
  try {
    const totalRevenueResult = await prisma.booking.aggregate({
      _sum: {
        fareAmount: true,
      },
      where: {
        status: 'CONFIRMED',
      }
    });

    const activeBookingsCount = await prisma.booking.count({
      where: {
        status: 'CONFIRMED',
      }
    });

    const waitlistedCount = await prisma.waitlistEntry.count({
      where: {
        status: 'WAITING',
      }
    });

    const totalSeatsCount = await prisma.seat.count({
      where: {
        coach: {
          type: 'RESERVED'
        }
      }
    });

    res.json({
      totalRevenue: totalRevenueResult._sum.fareAmount || 0,
      activeBookings: activeBookingsCount,
      waitlistedPassengers: waitlistedCount,
      totalSeats: totalSeatsCount
    });
  } catch (err) {
    next(err);
  }
});

export default router;
