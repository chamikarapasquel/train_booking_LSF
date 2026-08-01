# Lanka Scenic Rail — Segment Booking System

A seat booking system for the Colombo Fort → Badulla upcountry train line where a seat can be
booked by multiple passengers across different parts of the route — each paying only for the
distance they actually travel.

---

## The Core Problem

On Sri Lanka's reserved coaches, once a passenger books Colombo Fort → Kandy, that seat
sits empty from Kandy onwards. Nobody else can book it. The train loses revenue, and
passengers pay more than they should.

This system solves that by letting the same physical seat be booked in non-overlapping
segments. Passenger A takes it Colombo → Kandy. Passenger B books it Kandy → Badulla.
Both pay only for their distance.

---

## Design Decisions

### 1. Half-Open Intervals for Segment Overlap

Every booking stores two integers: `fromStationOrder` and `toStationOrder` — the position of
each station on the route. A seat is considered taken if an existing booking overlaps the
requested segment.

The overlap check is:

```
existing.from < new.to  AND  existing.to > new.from
```

**Why half-open `[from, to)` and not closed `[from, to]`?**

With a closed interval, a booking from A→B and another from B→C would "conflict" at station B
even though the first passenger already left. The half-open model avoids this completely —
two back-to-back bookings never overlap, and the math stays simple with no special edge cases.

**Why store order integers directly on the Booking row?**

To avoid joining to the Station table on every availability check. The `(seatId, status,
fromStationOrder, toStationOrder)` index turns the overlap query into a fast index-only scan.
Denormalising those two integers is a small cost for a significant query simplification.

**What was considered instead?**
- Storing only station IDs and joining at query time — rejected because it adds a join on every
  seat availability check, which runs every time the seat map loads.

---

### 2. Pessimistic Locking to Prevent Double-Booking

**The race condition:** Two users open the seat map at the same time. Both see seat 1A as free.
Both click it. Both submit. Without a lock, both bookings go through — one seat, two owners.

**The fix:** Before checking availability, the booking transaction locks the seat row at the
database level using `SELECT FOR UPDATE`. Any other transaction trying to book the same seat
is blocked until the first one finishes.

```
BEGIN
  SELECT ... FROM Seat WHERE id = ? FOR UPDATE   ← blocks concurrent transactions here
  check for overlapping confirmed bookings
  if clear → INSERT booking
COMMIT
```

**Why pessimistic locking and not optimistic locking?**

Optimistic locking works like this: read the current state, write only if nothing changed, retry
if it did. That is fine when conflicts are rare. For a popular seat during a busy period, many
users could be trying at once — optimistic locking would cause a storm of retries and make the
user experience unpredictable. Pessimistic locking serialises access to one seat at a time. The
lock is held for only a few milliseconds, so it is not a bottleneck in practice.

**Why lock at the row level and not the table level?**

Locking the whole table would mean no two bookings anywhere in the system could happen at the
same time. Locking only the one seat row being booked leaves all other seats completely free to
be booked concurrently.

**The Prisma limitation:**
Prisma's query builder does not support `FOR UPDATE` natively. The solution is to drop into a
raw query just for the lock step, then continue the rest of the transaction with Prisma's
typed API. It is a small compromise in exchange for full concurrency safety.

---

### 3. Soft Delete for Cancellations

Cancelling a booking sets its `status` to `CANCELLED` instead of deleting the row.

**Why not just delete it?**
- Deleted rows cannot be audited or reported on later.
- A soft delete keeps the history intact — useful for disputes, revenue tracking, and debugging.
- The availability query simply ignores `CANCELLED` rows, so it stays just as simple.

**What was considered instead?**
- A separate `CancelledBookings` table — rejected because it splits the same data across two
  tables for no real benefit.

---

### 4. Database and Tech Choices

**PostgreSQL over MongoDB**

This system needs proper transactions and row-level locking. MongoDB's document model does not
support `SELECT FOR UPDATE`. Using it here would require building a custom locking mechanism
from scratch, which would be fragile and hard to reason about. PostgreSQL gives ACID guarantees
out of the box.

**Express over a more opinionated framework (e.g. NestJS)**

NestJS adds decorators, modules, and a lot of ceremony. For an API with four route files, that
overhead is not justified. Express is explicit and predictable — you can read the entire routing
setup in one file.

**Prisma over a raw query builder (e.g. Knex)**

Prisma generates TypeScript types from the schema automatically. Every query result is typed.
This catches shape mismatches at compile time, not at runtime. The tradeoff is the occasional
`$queryRaw` call when Prisma does not support a specific SQL feature (like `FOR UPDATE`).

**REST over GraphQL**

The API has six endpoints. GraphQL's main benefit — flexible querying — is not needed here. REST
is simpler, easier to document, and has no overhead.

**Vanilla CSS over Tailwind**

The design system is built with CSS custom properties (variables). This gives full control over
every token — colours, spacing, radius, shadows — without adding a build-time dependency or
learning a utility class vocabulary. Every style in the project is readable plain CSS.

**Vite over Create React App**

CRA is no longer maintained and is slow. Vite starts in milliseconds and has native TypeScript
and proxy support. It was the obvious choice.

---

### 5. Fare Calculation

```
fare = (destination_km − origin_km) × RATE_PER_KM
```

`distanceKm` for each station is stored in the database (distance from Colombo Fort).
`RATE_PER_KM` is an environment variable — the railway department can change the fare rate
without touching any code.

**What was considered instead?**
- A separate fares table with per-leg pricing — rejected for this scope. The linear distance
  model is accurate enough and far simpler to manage.

---

## Challenges

### Getting the interval edges exactly right

The trickiest part was deciding whether station B belongs to the A→B booking or the B→C booking.
If the interval is closed on both ends `[A, B]` and `[B, C]`, they conflict at B. The fix is
the half-open interval `[from, to)` — the passenger occupies the seat up to but not including
the arrival station, so the seat is free the moment it reaches that station. This makes
consecutive bookings conflict-free with no special-case logic.

### Prisma does not support SELECT FOR UPDATE

Prisma's typed query builder has no `forUpdate()` option. The workaround is
`tx.$queryRaw\`SELECT id FROM "Seat" WHERE id = ${id} FOR UPDATE\`` inside an interactive
transaction. The result is just the ID — enough to acquire the lock. The rest of the
transaction continues through Prisma's type-safe API. It works, but it means one raw SQL
string lives in otherwise fully-typed code.

### Docker networking between the browser and nginx

The React app is served by nginx inside Docker. The browser, however, is outside Docker.
When the browser makes an API call, it cannot reach `backend:4000` (the internal Docker
hostname) — that only works container-to-container. The solution: nginx listens for
`/api/*` requests coming in from the browser on port 3000 and forwards them to `backend:4000`
internally. The browser never needs to know the backend's address.

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
│   │   ├── seed.ts               # 40 stations, 3 reserved coaches, 144 seats
│   │   └── migrations/
│   └── src/
│       ├── index.ts              # Express app + global error handler
│       ├── config.ts             # env variable validation
│       ├── db.ts                 # singleton Prisma client
│       ├── errors.ts             # typed error classes (404, 409, 400)
│       ├── routes/               # stations, coaches, seats, bookings
│       └── services/
│           ├── availabilityService.ts   # interval overlap logic
│           └── bookingService.ts        # atomic booking with row lock
│
└── frontend/
    └── src/
        ├── App.tsx               # 4-step booking flow state machine
        ├── api/client.ts         # typed fetch wrappers
        ├── components/           # RouteSelect, SeatMap, PassengerForm, BookingConfirmation
        ├── types/index.ts        # shared TypeScript interfaces
        └── index.css             # full design system via CSS variables
```
#   t r a i n _ b o o k i n g _ L S F  
 