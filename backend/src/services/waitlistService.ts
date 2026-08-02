// waitlistService.ts — manages the waitlist queue with atomic seat promotion.

import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { config } from '../config';
import { NotFoundError, ValidationError } from '../errors';

export interface JoinWaitlistInput {
  fromStationId: string;
  toStationId:   string;
  passengerName: string;
}

export interface WaitlistEntryResult {
  id:                string;
  passengerName:     string;
  fromStation:       { id: string; name: string; order: number };
  toStation:         { id: string; name: string; order: number };
  fareAmount:        number;
  position:          number;
  queueAhead:        number;   // how many WAITING entries are ahead of this one
  status:            string;
  promotedBookingId: string | null;
  createdAt:         Date;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Adds a passenger to the waitlist for a fully-booked leg.
 * Calculates the fare up-front so the passenger sees it immediately.
 * Position = (max current position for this leg) + 1.
 */
export async function joinWaitlist(input: JoinWaitlistInput): Promise<WaitlistEntryResult> {
  const { fromStationId, toStationId, passengerName } = input;

  if (!passengerName.trim()) {
    throw new ValidationError('Passenger name is required');
  }

  return prisma.$transaction(async (tx) => {
    // Validate stations
    const [fromStation, toStation] = await Promise.all([
      tx.station.findUnique({ where: { id: fromStationId } }),
      tx.station.findUnique({ where: { id: toStationId } }),
    ]);
    if (!fromStation) throw new NotFoundError(`Station not found: ${fromStationId}`);
    if (!toStation)   throw new NotFoundError(`Station not found: ${toStationId}`);
    if (fromStation.order >= toStation.order) {
      throw new ValidationError('Origin station must come before destination on the route');
    }

    const fromOrder  = fromStation.order;
    const toOrder    = toStation.order;
    const fareAmount = calcFare(fromStation.distanceKm, toStation.distanceKm);

    // Determine next queue position for this exact leg
    const last = await tx.waitlistEntry.findFirst({
      where: {
        fromStationOrder: fromOrder,
        toStationOrder:   toOrder,
        status:           'WAITING',
      },
      orderBy: { position: 'desc' },
      select:  { position: true },
    });
    const position = (last?.position ?? 0) + 1;

    const entry = await tx.waitlistEntry.create({
      data: {
        fromStationId,
        toStationId,
        fromStationOrder: fromOrder,
        toStationOrder:   toOrder,
        passengerName:    passengerName.trim(),
        fareAmount,
        position,
        status:           'WAITING',
      },
      include: {
        fromStation: true,
        toStation:   true,
      },
    });

    return formatEntry(entry, 0);
  });
}

/**
 * Returns a waitlist entry by ID with its current queue-ahead count.
 */
export async function getWaitlistEntry(entryId: string): Promise<WaitlistEntryResult> {
  const entry = await prisma.waitlistEntry.findUnique({
    where:   { id: entryId },
    include: { fromStation: true, toStation: true },
  });
  if (!entry) throw new NotFoundError(`Waitlist entry not found: ${entryId}`);

  const queueAhead = entry.status === 'WAITING'
    ? await prisma.waitlistEntry.count({
        where: {
          fromStationOrder: entry.fromStationOrder,
          toStationOrder:   entry.toStationOrder,
          status:           'WAITING',
          position:         { lt: entry.position },
        },
      })
    : 0;

  return formatEntry(entry, queueAhead);
}

/**
 * Passenger withdraws from the waitlist.
 */
export async function cancelWaitlistEntry(entryId: string): Promise<WaitlistEntryResult> {
  const entry = await prisma.waitlistEntry.findUnique({
    where:   { id: entryId },
    include: { fromStation: true, toStation: true },
  });
  if (!entry) throw new NotFoundError(`Waitlist entry not found: ${entryId}`);
  if (entry.status !== 'WAITING') {
    throw new ValidationError(`Cannot cancel a waitlist entry with status: ${entry.status}`);
  }

  const updated = await prisma.waitlistEntry.update({
    where:   { id: entryId },
    data:    { status: 'CANCELLED' },
    include: { fromStation: true, toStation: true },
  });
  return formatEntry(updated, 0);
}

/**
 * Called inside cancelBooking's transaction.
 * Finds the earliest WAITING entry whose leg overlaps [fromOrder, toOrder),
 * picks an available seat for it, creates a CONFIRMED Booking, and
 * marks the entry as PROMOTED.
 *
 * Must receive the transaction client so it participates in the same ACID unit.
 */
export async function promoteFromWaitlist(
  fromOrder: number,
  toOrder:   number,
  tx:        Prisma.TransactionClient,
): Promise<void> {
  // Find the earliest waiting entry for this exact leg
  const entry = await tx.waitlistEntry.findFirst({
    where: {
      fromStationOrder: fromOrder,
      toStationOrder:   toOrder,
      status:           'WAITING',
    },
    orderBy: { position: 'asc' },
    include: { fromStation: true, toStation: true },
  });

  if (!entry) return; // nobody waiting — nothing to do

  // Find a free seat for this leg (same logic as availability check)
  const occupiedSeatIds = await tx.booking.findMany({
    where: {
      status:           'CONFIRMED',
      fromStationOrder: { lt: toOrder },
      toStationOrder:   { gt: fromOrder },
    },
    select:   { seatId: true },
    distinct: ['seatId'],
  });
  const occupiedSet = new Set(occupiedSeatIds.map((b) => b.seatId));

  const freeSeat = await tx.seat.findFirst({
    where: {
      coach: { type: 'RESERVED' },
      id:    { notIn: Array.from(occupiedSet) },
    },
    include: { coach: true },
    orderBy: [{ coach: { name: 'asc' } }, { seatNumber: 'asc' }],
  });

  if (!freeSeat) return; // still no seat available — leave in queue

  // Create the confirmed booking
  const booking = await tx.booking.create({
    data: {
      seatId:           freeSeat.id,
      fromStationId:    entry.fromStationId,
      toStationId:      entry.toStationId,
      fromStationOrder: entry.fromStationOrder,
      toStationOrder:   entry.toStationOrder,
      passengerName:    entry.passengerName,
      fareAmount:       entry.fareAmount,
      status:           'CONFIRMED',
    },
  });

  // Mark the waitlist entry as promoted
  await tx.waitlistEntry.update({
    where: { id: entry.id },
    data:  { status: 'PROMOTED', promotedBookingId: booking.id },
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function calcFare(fromKm: number, toKm: number): number {
  return parseFloat(((toKm - fromKm) * config.ratePerKm).toFixed(2));
}

type EntryWithStations = Awaited<ReturnType<typeof prisma.waitlistEntry.findUniqueOrThrow>> & {
  fromStation: { id: string; name: string; order: number };
  toStation:   { id: string; name: string; order: number };
};

function formatEntry(e: EntryWithStations, queueAhead: number): WaitlistEntryResult {
  return {
    id:                e.id,
    passengerName:     e.passengerName,
    fromStation:       { id: e.fromStation.id, name: e.fromStation.name, order: e.fromStation.order },
    toStation:         { id: e.toStation.id,   name: e.toStation.name,   order: e.toStation.order   },
    fareAmount:        e.fareAmount,
    position:          e.position,
    queueAhead,
    status:            e.status,
    promotedBookingId: e.promotedBookingId,
    createdAt:         e.createdAt,
  };
}
