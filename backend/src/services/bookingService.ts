/**
 * bookingService.ts
 *
 * Handles booking creation and cancellation with ACID guarantees.
 *
 * ─── Concurrency Strategy: Pessimistic Locking ──────────────────────────────
 * Problem: Two users simultaneously see seat 1A free for Colombo→Kandy.
 *   Both pass the availability check. Both insert a booking. Double-booking.
 *
 * Solution: `SELECT ... FOR UPDATE` inside a serialisable transaction.
 *
 *   BEGIN;
 *     SELECT id FROM "Seat" WHERE id = $seatId FOR UPDATE;
 *     -- This locks the seat row. Any other transaction trying to lock
 *     -- the same row BLOCKS here until we COMMIT or ROLLBACK.
 *     -- ↳ Check for overlapping bookings (safe — no concurrent write can
 *     --   sneak in between the check and the insert).
 *     INSERT INTO bookings ...
 *   COMMIT;
 *
 * Why pessimistic over optimistic?
 *   Optimistic locking (check-version, retry on conflict) works well when
 *   conflicts are rare (e.g. editing a document). A train seat during peak
 *   hours can have dozens of simultaneous booking attempts — the retry storm
 *   under optimistic locking would be worse than the short queue under
 *   pessimistic locking. The lock is held for ~5ms.
 *
 * Why row-level not table-level?
 *   We lock only the one seat row being booked. Other seats on the same
 *   train continue to be bookable concurrently — no unnecessary contention.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from '../db';
import { config } from '../config';
import { ConflictError, NotFoundError, ValidationError } from '../errors';

export interface CreateBookingInput {
  seatId: string;
  fromStationId: string;
  toStationId: string;
  passengerName: string;
}

export interface BookingResult {
  id: string;
  seatId: string;
  seatNumber: string;
  coachName: string;
  fromStation: { id: string; name: string; order: number };
  toStation:   { id: string; name: string; order: number };
  passengerName: string;
  fareAmount: number;
  status: string;
  createdAt: Date;
}

/** Calculates the fare for a leg based on distance and config rate. */
function calculateFare(fromDistanceKm: number, toDistanceKm: number): number {
  const distance = toDistanceKm - fromDistanceKm;
  return parseFloat((distance * config.ratePerKm).toFixed(2));
}

/**
 * Creates a booking atomically.
 * Uses SELECT FOR UPDATE to prevent double-booking under concurrent load.
 */
export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  const { seatId, fromStationId, toStationId, passengerName } = input;

  if (!passengerName.trim()) {
    throw new ValidationError('Passenger name is required');
  }

  return prisma.$transaction(async (tx) => {
    // ── Step 1: Lock the seat row ────────────────────────────────────────────
    // Any concurrent transaction trying to book this same seat will block
    // here until we commit or rollback. This is the critical section.
    const lockedSeats = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Seat" WHERE id = ${seatId} FOR UPDATE
    `;

    if (lockedSeats.length === 0) {
      throw new NotFoundError(`Seat not found: ${seatId}`);
    }

    // ── Step 2: Validate the seat is in a reserved coach ────────────────────
    const seat = await tx.seat.findUnique({
      where: { id: seatId },
      include: { coach: true },
    });
    if (!seat) throw new NotFoundError(`Seat not found: ${seatId}`);
    if (seat.coach.type !== 'RESERVED') {
      throw new ValidationError('Only reserved coach seats can be individually booked');
    }

    // ── Step 3: Fetch station info ───────────────────────────────────────────
    const [fromStation, toStation] = await Promise.all([
      tx.station.findUnique({ where: { id: fromStationId } }),
      tx.station.findUnique({ where: { id: toStationId } }),
    ]);
    if (!fromStation) throw new NotFoundError(`Station not found: ${fromStationId}`);
    if (!toStation)   throw new NotFoundError(`Station not found: ${toStationId}`);
    if (fromStation.order >= toStation.order) {
      throw new ValidationError('Origin station must come before destination on the route');
    }

    const fromOrder = fromStation.order;
    const toOrder   = toStation.order;

    // ── Step 4: Check for overlapping confirmed bookings ─────────────────────
    // Safe to do after locking — no concurrent transaction can insert a
    // conflicting booking until this transaction completes.
    const conflicts = await tx.booking.count({
      where: {
        seatId,
        status: 'CONFIRMED',
        fromStationOrder: { lt: toOrder },   // half-open interval overlap test
        toStationOrder:   { gt: fromOrder },
      },
    });

    if (conflicts > 0) {
      throw new ConflictError(
        `Seat ${seat.coach.name} ${seat.seatNumber} is not available for ${fromStation.name} → ${toStation.name}`,
      );
    }

    // ── Step 5: Calculate fare and create the booking ────────────────────────
    const fareAmount = calculateFare(fromStation.distanceKm, toStation.distanceKm);

    const booking = await tx.booking.create({
      data: {
        seatId,
        fromStationId,
        toStationId,
        fromStationOrder: fromOrder,
        toStationOrder:   toOrder,
        passengerName:    passengerName.trim(),
        fareAmount,
        status: 'CONFIRMED',
      },
      include: {
        seat:        { include: { coach: true } },
        fromStation: true,
        toStation:   true,
      },
    });

    return formatBooking(booking);
  });
}

/**
 * Cancels a booking, freeing its seat segment for future bookings.
 * Uses a soft-delete (status = CANCELLED) so booking history is preserved.
 */
export async function cancelBooking(bookingId: string): Promise<BookingResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      seat:        { include: { coach: true } },
      fromStation: true,
      toStation:   true,
    },
  });

  if (!booking) throw new NotFoundError(`Booking not found: ${bookingId}`);
  if (booking.status === 'CANCELLED') {
    throw new ConflictError('Booking is already cancelled');
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data:  { status: 'CANCELLED' },
    include: {
      seat:        { include: { coach: true } },
      fromStation: true,
      toStation:   true,
    },
  });

  return formatBooking(updated);
}

/**
 * Retrieves a single booking by ID.
 */
export async function getBookingById(bookingId: string): Promise<BookingResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      seat:        { include: { coach: true } },
      fromStation: true,
      toStation:   true,
    },
  });

  if (!booking) throw new NotFoundError(`Booking not found: ${bookingId}`);
  return formatBooking(booking);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

type FullBooking = Awaited<ReturnType<typeof prisma.booking.findUniqueOrThrow>> & {
  seat: { seatNumber: string; coach: { name: string } };
  fromStation: { id: string; name: string; order: number };
  toStation:   { id: string; name: string; order: number };
};

function formatBooking(b: FullBooking): BookingResult {
  return {
    id:            b.id,
    seatId:        b.seatId,
    seatNumber:    b.seat.seatNumber,
    coachName:     b.seat.coach.name,
    fromStation:   { id: b.fromStation.id, name: b.fromStation.name, order: b.fromStation.order },
    toStation:     { id: b.toStation.id,   name: b.toStation.name,   order: b.toStation.order   },
    passengerName: b.passengerName,
    fareAmount:    b.fareAmount,
    status:        b.status,
    createdAt:     b.createdAt,
  };
}
