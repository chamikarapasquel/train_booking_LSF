# Lanka Scenic Rail — Segment-Based Train Seat Booking System

> **Colombo Fort → Badulla Upcountry Line** — Book only the distance you travel.

---

## The Problem This Solves

Sri Lanka's upcountry reserved coaches are frequently under-occupied for long stretches of the route. Under the old system, a passenger booking Colombo Fort → Kandy effectively paid for the entire Colombo Fort → Badulla journey, since their seat couldn't be re-sold after departure.

This system lets a seat be booked in multiple non-overlapping segments. Passenger A travels Colombo Fort → Kandy; Passenger B then books Kandy → Badulla on the same physical seat — each paying only for their distance. Revenue increases, fares become fairer.

---

## Quick Start (Docker — recommended)

**Prerequisites:** Docker Desktop installed and running.

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/train_booking_LSF.git
cd train_booking_LSF

# 2. Copy the environment file and set your own values
cp .env.example .env
# Edit .env — at minimum change POSTGRES_PASSWORD

# 3. Spin up everything
docker-compose up --build
```

That's it. The first startup:
- Starts PostgreSQL and waits for it to be healthy
- Runs `prisma migrate deploy` (applies the DB schema)
- Runs the seed script (40 stations, 3 reserved coaches, 144 seats)
- Starts the Express API on port 4000
- Builds and serves the React frontend on port 3000

**Visit:** http://localhost:3000

---

## Running in Development (without Docker)

**Prerequisites:** Node.js 20+, a running PostgreSQL instance.

```bash
# 1. Set up the backend
cd backend
cp ../.env.example .env          # edit DATABASE_URL and other vars
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev                      # starts on :4000 with hot-reload

# 2. In a new terminal — set up the frontend
cd frontend
npm install
npm run dev                      # starts on :5173, proxies /api to :4000
```

**Visit:** http://localhost:5173

---

## Project Structure

```
train_booking_LSF/
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # data model
│   │   ├── seed.ts               # idempotent seed script
│   │   └── migrations/           # version-controlled SQL migrations
│   └── src/
│       ├── index.ts              # Express entry point
│       ├── config.ts             # environment variable validation
│       ├── db.ts                 # singleton Prisma client
│       ├── errors.ts             # typed AppError hierarchy
│       ├── routes/               # Express routers
│       └── services/
│           ├── availabilityService.ts   # interval overlap query
│           └── bookingService.ts        # atomic booking with locking
│
└── frontend/
    └── src/
        ├── App.tsx               # booking flow state machine
        ├── api/client.ts         # typed API wrappers
        ├── components/
        │   ├── RouteSelect.tsx
        │   ├── SeatMap.tsx       # AB/CD grid seat map
        │   ├── PassengerForm.tsx
        │   └── BookingConfirmation.tsx
        └── index.css             # full design system (CSS variables)
```

---

## Core Design Decisions

### 1. Half-Open Interval Model for Segment Booking

Each booking stores `fromStationOrder` and `toStationOrder` (integer positions on the route) directly on the booking row (denormalised). A new booking `[newFrom, newTo)` conflicts with an existing `[existFrom, existTo)` when:

```
existFrom < newTo  AND  existTo > newFrom
```

**Why half-open `[from, to)` instead of closed `[from, to]`?**
Two consecutive bookings — A→B and B→C — should *not* conflict. With a half-open interval, the passenger leaving at B and the passenger boarding at B share no overlap. The availability query becomes a pair of integer comparisons with no edge cases.

**Why denormalise the order values onto the Booking row?**
To avoid joining to the `Station` table on every availability check. The composite index on `(seatId, status, fromStationOrder, toStationOrder)` makes overlap detection a single, index-only scan.

---

### 2. Pessimistic Locking (SELECT FOR UPDATE) for Concurrency

**The race condition:** Two users simultaneously check seat 1A for Colombo→Kandy. Both see it free. Both insert a booking. Double-booking.

**Solution:** Inside a Prisma `$transaction`, we lock the seat row before the availability check:

```sql
BEGIN;
  SELECT id FROM "Seat" WHERE id = $seatId FOR UPDATE;
  -- All other transactions trying to lock this row BLOCK here.
  -- The check-then-insert is now safe.
  SELECT COUNT(*) FROM "Booking" WHERE seatId = $seatId AND status = 'CONFIRMED'
    AND fromStationOrder < $toOrder AND toStationOrder > $fromOrder;
  INSERT INTO "Booking" ...;
COMMIT;
```

**Why pessimistic over optimistic?**
Optimistic locking (read-version, write-if-version-unchanged, retry on conflict) works well when conflicts are rare. During peak booking, a popular seat can have dozens of concurrent attempts. Pessimistic locking serialises access to one seat row; the lock is held for ~5ms. Optimistic locking would cause a retry storm that's harder to reason about and exposes users to more uncertainty.

**Why row-level, not table-level?**
We lock only the one seat being booked. All other seats remain fully concurrent.

---

### 3. Soft-Delete for Cancellations

Cancelled bookings set `status = 'CANCELLED'` rather than being deleted. This:
- Preserves the booking history (audit trail, revenue reporting)
- Makes the availability query simple: only `status = 'CONFIRMED'` rows are considered

---

### 4. Configurable Route & Fleet

Stations, coaches, and seats are database-seeded — not hardcoded. The route can be extended (new stations, different order) by updating the seed file and running a new migration. Coach count and seat layout (rows × columns) are controlled by env vars `RESERVED_COACH_ROWS` and `RESERVED_COACH_COLS`.

---

### 5. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js + TypeScript | Type safety end-to-end; great Prisma integration |
| Framework | Express | Lightweight, explicit; no magic |
| ORM | Prisma | Typed queries, migrations, `$queryRaw` for `FOR UPDATE` |
| Database | PostgreSQL | ACID, `SELECT FOR UPDATE`, reliable advisory locks |
| Frontend | React + Vite | Component model suits seat map; Vite is fast |
| Styling | Vanilla CSS | Full control; no framework overhead |
| Container | Docker + nginx | Single-command startup; nginx proxies /api in prod |

**Alternatives considered:**
- **MongoDB** — rejected; ACID transactions and `SELECT FOR UPDATE` are non-negotiable for a booking system
- **Optimistic locking** — rejected; see concurrency section above
- **GraphQL** — rejected; REST is simpler and sufficient for this API surface
- **Next.js** — rejected; adds SSR complexity we don't need for a SPA booking flow

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stations` | All stations, ordered by route position |
| `GET` | `/api/coaches` | All coaches with type and capacity |
| `GET` | `/api/seats/availability?fromStationId=X&toStationId=Y` | Seat availability for a leg |
| `POST` | `/api/bookings` | Create a booking (atomic, `409` on conflict) |
| `GET` | `/api/bookings/:id` | Get booking details |
| `DELETE` | `/api/bookings/:id` | Cancel a booking (soft-delete) |
| `GET` | `/health` | Health check |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `train_booking` | PostgreSQL database name |
| `POSTGRES_USER` | `trainuser` | PostgreSQL username |
| `POSTGRES_PASSWORD` | — | **Set this in .env** |
| `DATABASE_URL` | — | Full connection string (auto-built by docker-compose) |
| `PORT` | `4000` | Backend port |
| `RATE_PER_KM` | `2.5` | LKR per km for reserved coach fares |
| `RESERVED_COACH_ROWS` | `12` | Rows per reserved coach (seed-time config) |
| `RESERVED_COACH_COLS` | `4` | Columns per reserved coach (A/B/C/D) |

---

## Challenges

**1. Interval overlap correctness at the edges**
Getting the half-open interval right took careful thought. Specifically: should station B be included in the A→B booking? If both are closed (inclusive), then A→B and B→C conflict at B. The half-open model `[from, to)` cleanly solves this — two consecutive bookings never share an overlapping order value.

**2. Prisma + SELECT FOR UPDATE**
Prisma's typed query builder doesn't support `FOR UPDATE` directly. The solution is `tx.$queryRaw\`SELECT id FROM "Seat" WHERE id = ${id} FOR UPDATE\`` inside an interactive transaction — giving us the lock while keeping the rest of the booking logic in Prisma's type-safe API.

**3. Docker-compose networking**
The React frontend is served by nginx, which runs inside the Docker network. The browser accesses the frontend from outside Docker (`localhost:3000`). API calls from the browser must also go to `localhost:4000` — not `backend:4000` (which is the internal Docker hostname). The nginx `proxy_pass` configuration handles this: the browser hits `localhost:3000/api/*`, nginx forwards it to `backend:4000` inside the Docker network. No environment-baking of the API URL needed.

---

## Fare Logic

`fare = (destination_km - origin_km) × RATE_PER_KM`

Where `RATE_PER_KM` defaults to LKR 2.50/km. Example: Colombo Fort → Kandy (121 km) = **LKR 302.50**.

The rate is configurable via `.env`, making it trivial for the department to adjust pricing without a code change.
