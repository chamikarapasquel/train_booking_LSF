/**
 * Prisma seed script — populates the database with:
 *   - All 40 real stations on the Colombo Fort → Badulla line
 *   - 8 coaches (3 RESERVED, 5 UNRESERVED)
 *   - 144 individually numbered seats across the 3 reserved coaches
 *
 * Coaches and seats per coach are configurable via RESERVED_COACH_ROWS
 * and RESERVED_COACH_COLS env vars (defaults: 12 rows × 4 columns = 48 seats).
 */

import { PrismaClient, CoachType } from '@prisma/client';

const prisma = new PrismaClient();

// ── Station data ─────────────────────────────────────────────────────────────
// Real stations on the Colombo Fort–Badulla upcountry main line.
// order: 0-based position along the route
// distanceKm: approximate km from Colombo Fort (used for fare calculation)
const STATIONS = [
  { name: 'Colombo Fort',    order:  0, distanceKm:   0 },
  { name: 'Maradana',        order:  1, distanceKm:   2 },
  { name: 'Dematagoda',      order:  2, distanceKm:   4 },
  { name: 'Baseline Road',   order:  3, distanceKm:   5 },
  { name: 'Kelaniya',        order:  4, distanceKm:  10 },
  { name: 'Walpola',         order:  5, distanceKm:  12 },
  { name: 'Hunupitiya',      order:  6, distanceKm:  14 },
  { name: 'Ragama',          order:  7, distanceKm:  20 },
  { name: 'Gampaha',         order:  8, distanceKm:  30 },
  { name: 'Bemmulla',        order:  9, distanceKm:  35 },
  { name: 'Veyangoda',       order: 10, distanceKm:  40 },
  { name: 'Yaggahapitiya',   order: 11, distanceKm:  47 },
  { name: 'Meerigama',       order: 12, distanceKm:  54 },
  { name: 'Weerambugedara',  order: 13, distanceKm:  60 },
  { name: 'Polgahawela',     order: 14, distanceKm:  68 },
  { name: 'Alawwa',          order: 15, distanceKm:  75 },
  { name: 'Rambukkana',      order: 16, distanceKm:  83 },
  { name: 'Kadugannawa',     order: 17, distanceKm: 101 },
  { name: 'Peradeniya',      order: 18, distanceKm: 113 },
  { name: 'Kandy',           order: 19, distanceKm: 121 },
  { name: 'Mahakanda',       order: 20, distanceKm: 128 },
  { name: 'Gampola',         order: 21, distanceKm: 134 },
  { name: 'Ulapane',         order: 22, distanceKm: 142 },
  { name: 'Nawalapitiya',    order: 23, distanceKm: 153 },
  { name: 'Watawala',        order: 24, distanceKm: 162 },
  { name: 'Hatton',          order: 25, distanceKm: 173 },
  { name: 'Kotagala',        order: 26, distanceKm: 184 },
  { name: 'Nanuoya',         order: 27, distanceKm: 196 },
  { name: 'Ambewela',        order: 28, distanceKm: 204 },
  { name: 'Pattipola',       order: 29, distanceKm: 212 },
  { name: 'Ohiya',           order: 30, distanceKm: 219 },
  { name: 'Haputale',        order: 31, distanceKm: 238 },
  { name: 'Diyatalawa',      order: 32, distanceKm: 247 },
  { name: 'Bandarawela',     order: 33, distanceKm: 254 },
  { name: 'Heeloya',         order: 34, distanceKm: 260 },
  { name: 'Ella',            order: 35, distanceKm: 266 },
  { name: 'Demodara',        order: 36, distanceKm: 273 },
  { name: 'Hali-Ela',        order: 37, distanceKm: 280 },
  { name: 'Uduhawara',       order: 38, distanceKm: 286 },
  { name: 'Badulla',         order: 39, distanceKm: 292 },
];

// ── Coach configuration ───────────────────────────────────────────────────────
// Configurable: set env vars to change layout without touching code.
const ROWS = parseInt(process.env.RESERVED_COACH_ROWS ?? '12', 10);   // rows per coach
const COLS = ['A', 'B', 'C', 'D'].slice(0, parseInt(process.env.RESERVED_COACH_COLS ?? '4', 10));

const RESERVED_COACHES  = ['R1', 'R2', 'R3'];
const UNRESERVED_COACHES = [
  { name: 'U1', capacity: 64 },
  { name: 'U2', capacity: 64 },
  { name: 'U3', capacity: 80 },
  { name: 'U4', capacity: 80 },
  { name: 'U5', capacity: 64 },
];

async function main() {
  console.log('🌱 Starting database seed…');

  // 1. Upsert all stations
  console.log(`   Seeding ${STATIONS.length} stations…`);
  for (const station of STATIONS) {
    await prisma.station.upsert({
      where: { name: station.name },
      update: { order: station.order, distanceKm: station.distanceKm },
      create: station,
    });
  }

  // 2. Upsert reserved coaches + their seats
  const seatsPerCoach = ROWS * COLS.length;
  console.log(`   Seeding ${RESERVED_COACHES.length} reserved coaches (${seatsPerCoach} seats each)…`);
  for (const coachName of RESERVED_COACHES) {
    const coach = await prisma.coach.upsert({
      where: { name: coachName },
      update: { type: CoachType.RESERVED, capacity: seatsPerCoach },
      create: { name: coachName, type: CoachType.RESERVED, capacity: seatsPerCoach },
    });

    for (let row = 1; row <= ROWS; row++) {
      for (const col of COLS) {
        const seatNumber = `${row}${col}`;
        await prisma.seat.upsert({
          where: { coachId_seatNumber: { coachId: coach.id, seatNumber } },
          update: {},
          create: { coachId: coach.id, seatNumber },
        });
      }
    }
  }

  // 3. Upsert unreserved coaches (no individual seats needed)
  console.log(`   Seeding ${UNRESERVED_COACHES.length} unreserved coaches…`);
  for (const { name, capacity } of UNRESERVED_COACHES) {
    await prisma.coach.upsert({
      where: { name },
      update: { type: CoachType.UNRESERVED, capacity },
      create: { name, type: CoachType.UNRESERVED, capacity },
    });
  }

  const totalSeats = await prisma.seat.count();
  console.log(`✅ Seed complete! ${STATIONS.length} stations | ${RESERVED_COACHES.length + UNRESERVED_COACHES.length} coaches | ${totalSeats} bookable seats`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
