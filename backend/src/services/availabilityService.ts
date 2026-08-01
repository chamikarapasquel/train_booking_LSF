/**
 * availabilityService.ts
 *
 * Core logic for determining which seats are available for a given leg.
 *
 * ─── The Overlap Formula ────────────────────────────────────────────────────
 * A seat is UNAVAILABLE for leg [newFrom, newTo) if there is any CONFIRMED
 * booking [existFrom, existTo) where:
 *
 *   existFrom < newTo   AND   existTo > newFrom
 *
 * This is the standard interval overlap test. We use a half-open interval
 * [from, to) so that two consecutive bookings (A→B, B→C) on the same seat
 * do NOT conflict. The passenger leaving at B and the passenger boarding at B
 * can share the same physical seat without issue.
 *
 * We store fromStationOrder and toStationOrder directly on the Booking row
 * (denormalised from the Station table) so this query is a pure integer
 * comparison — no JOIN required, and the composite index on
 * (seatId, status, fromStationOrder, toStationOrder) makes it fast.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from '../db';
import { NotFoundError } from '../errors';

export interface SeatAvailabilityResult {
  seatId: string;
  seatNumber: string;
  coachId: string;
  coachName: string;
  available: boolean;
}

/**
 * Returns every seat in reserved coaches, annotated with whether it is
 * available for the leg [fromStationId → toStationId].
 */
export async function getSeatAvailability(
  fromStationId: string,
  toStationId: string,
): Promise<SeatAvailabilityResult[]> {
  // Fetch both stations to get their order values
  const [fromStation, toStation] = await Promise.all([
    prisma.station.findUnique({ where: { id: fromStationId } }),
    prisma.station.findUnique({ where: { id: toStationId } }),
  ]);

  if (!fromStation) throw new NotFoundError(`Station not found: ${fromStationId}`);
  if (!toStation)   throw new NotFoundError(`Station not found: ${toStationId}`);
  if (fromStation.order >= toStation.order) {
    throw new Error('Origin must come before destination on the route');
  }

  const fromOrder = fromStation.order;
  const toOrder   = toStation.order;

  // Find all seats that have at least one CONFIRMED booking overlapping this leg
  const occupiedSeatIds = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      fromStationOrder: { lt: toOrder },    // existing booking starts before our leg ends
      toStationOrder:   { gt: fromOrder },  // existing booking ends after our leg starts
    },
    select: { seatId: true },
    distinct: ['seatId'],
  });

  const occupiedSet = new Set(occupiedSeatIds.map((b) => b.seatId));

  // Fetch all seats in RESERVED coaches
  const seats = await prisma.seat.findMany({
    where: { coach: { type: 'RESERVED' } },
    include: { coach: true },
    orderBy: [{ coach: { name: 'asc' } }, { seatNumber: 'asc' }],
  });

  return seats.map((seat) => ({
    seatId:    seat.id,
    seatNumber: seat.seatNumber,
    coachId:   seat.coachId,
    coachName: seat.coach.name,
    available: !occupiedSet.has(seat.id),
  }));
}
