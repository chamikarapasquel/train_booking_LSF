# Lanka Scenic Rail — Segment Booking System

A robust, concurrency-safe seat booking system for the Colombo Fort → Badulla upcountry train line. It allows a single physical seat to be booked by multiple passengers across different, non-overlapping parts of the route, ensuring maximum utilization of train capacity and fair distance-based pricing.

---

## 🎯 Core Requirements Fulfilled

### 1. Segment-Based Booking
- **How it works:** A seat vacated partway through the trip instantly becomes available for someone else to book. For example, if Passenger A books "Colombo Fort → Kandy", the exact same physical seat can be booked by Passenger B for "Kandy → Badulla".
- **Modeling Occupancy:** Occupancy is modeled using **half-open intervals**. Each booking stores a `fromStationOrder` and `toStationOrder`. A seat is considered occupied if a new booking's interval overlaps an existing booking's interval (`existing.from < new.to AND existing.to > new.from`). This mathematical model cleanly resolves adjacent boundaries without conflict.
- **Fare Calculation:** Fares are dynamically calculated using the precise kilometer distance between the origin and destination stations, multiplied by a configurable base rate per kilometer.

### 2. Backend
- **Architecture:** An Express REST API backed by PostgreSQL and Prisma ORM.
- **Concurrency & Correctness:** Handles concurrent booking attempts seamlessly. If two passengers attempt to book the exact same seat at the exact same millisecond, the backend uses **pessimistic row-level locking (`SELECT FOR UPDATE`)** inside an ACID transaction to guarantee that only one booking succeeds, gracefully declining the other.

### 3. Frontend
- **User Flow:** A React-based interface (built with Vite) that guides the user through four intuitive steps:
  1. Select origin and destination stations.
  2. View real-time availability on a high-fidelity visual seat map and select a seat for that specific leg.
  3. Enter passenger details and confirm.
  4. View the generated booking confirmation ticket.

### 4. Build it for Real
- **Dynamic Configuration:** The system is not hardcoded. The number of stations, distances, train coaches, and seats per coach are entirely driven by the database schema and a robust seed script (`seed.ts`). The railway department can seamlessly add stations or append new coaches to the train without changing application code.
- **Scalability:** Designed with stateless backend nodes and row-level database locks, making it highly scalable and capable of handling real-world traffic spikes.

### 5. Running the Project
The entire system (PostgreSQL Database, Node/Express Backend, React/Vite Frontend, and Nginx reverse proxy) is containerized and orchestratable via a single command.

#### Quick Start
1. Ensure Docker and Docker Compose are installed on your machine.
2. Clone this repository.
3. Run the following command from the project root:
   ```bash
   docker compose up --build
   ```
4. The backend will automatically apply database migrations and seed the database with 40 stations, 3 coaches, and 144 seats.
5. Once running, open your browser and navigate to: **`http://localhost:8080`**

### 6. Version Control
The project was built iteratively using Git, with clear, descriptive commit messages tracking the evolution of the application from basic setup to the implementation of complex extra credit features.

---

## ✨ Extra Credit Features Built

We went above and beyond by implementing **4 out of the 5** suggested extra credit features:

### 1. A Seat Map Visualization
- **What it does:** Replaces a basic dropdown with an interactive, physical representation of train coaches. It visually maps out seats in a realistic 2x2 layout with a central aisle.
- **Details:** The map dynamically calculates availability for the exact segment requested. Seats that are already booked for *any* overlapping part of the journey are greyed out, while available seats are green and clickable. Users can flip between different coaches seamlessly.

### 2. Waitlisting for Fully Booked Segments
- **What it does:** If a user attempts to book a seat that was taken milliseconds prior (yielding a 409 Conflict), or if the train is completely sold out for a segment, they can join a waitlist.
- **Details:** Once waitlisted, the user enters an auto-polling waiting room. If an existing passenger cancels their ticket, the system **automatically and atomically** promotes the next eligible waitlisted passenger in line, and their UI updates instantly with a "🎉 You're In!" confirmation.

### 3. Clearer Handling of Booking Conflicts in the UI
- **What it does:** Solves the UX nightmare of a user clicking a seat, typing their name, and hitting "Confirm" only to find out someone else snagged the seat 5 seconds prior.
- **Details:** The UI gracefully catches `409 Conflict` errors and makes an immediate subsequent check to seat availability. It dynamically determines if the train is entirely full (showing a generic "Join Waitlist" prompt) or if only that specific seat was taken (showing a "Choose Another Seat" AND "Join Waitlist for This Seat" CTA). This is backed by real-time live polling for seat availability.

### 4. A Simple Admin View for the Department
- **What it does:** Provides the railway department with a high-level overview of the system's performance.
- **Details:** The admin dashboard visualizes live occupancy rates across the train line, tracks total revenue generated from distance-based segment fares, and provides insights into waitlist volume.

---

## 🏗️ Core Design Decisions & Reasoning

### 1. Half-Open Intervals for Segment Overlap
**Decision:** Store station order indices directly on the booking row and use half-open interval overlap logic (`[from, to)`).
**Reasoning:** With a closed interval, a booking from A→B and another from B→C would "conflict" at station B even though the first passenger already left. The half-open model avoids this completely.
**Alternatives Considered:** Storing only station IDs and joining the Station table at query time. *Rejected* because it adds a join on every seat availability check, significantly slowing down the seat map rendering which needs to evaluate all 144 seats instantly.

### 2. Pessimistic Locking to Prevent Double-Booking
**Decision:** Lock the specific seat row in the database using `SELECT FOR UPDATE` before confirming availability.
**Reasoning:** Pessimistic locking serializes access to one seat at a time at the database layer, ensuring perfect correctness during high-concurrency race conditions.
**Alternatives Considered:** 
- *Optimistic Locking* (retry on version mismatch): *Rejected* because it causes a storm of retries during high-traffic events, leading to a poor UX.
- *Table-level locking*: *Rejected* because locking the whole table means no two bookings anywhere on the train could happen simultaneously. Row-level locking leaves all other seats free to be booked concurrently.

### 3. Atomic Waitlist Promotion
**Decision:** When a user cancels a booking, check the waitlist and promote the next user within the *exact same database transaction* as the cancellation.
**Reasoning:** If cancellation and promotion were separate, a regular user looking at the seat map could snipe the newly freed seat in the split second before the waitlist system claimed it for the waiting user.
**Alternatives Considered:** A background cron job that polls for cancelled seats and promotes waitlisted users asynchronously. *Rejected* because it introduces race conditions with manual bookings and unfairly delays waitlist fulfillment.

### 4. Client-Side Polling vs. WebSockets for Waitlist
**Decision:** The Waitlist UI uses a 10-second polling mechanism to check if the user has been promoted.
**Reasoning:** Simple HTTP polling is stateless, cacheable, and trivial to scale.
**Alternatives Considered:** WebSockets or Server-Sent Events (SSE). *Rejected* because waitlisting is an edge case. Setting up, authenticating, and maintaining persistent WebSocket connections for all users adds immense infrastructure overhead that heavily outweighed the benefits.

### 5. Database & Tech Stack Choices
- **PostgreSQL over MongoDB:** We needed strict ACID guarantees and `SELECT FOR UPDATE` row-locking, which MongoDB does not natively support.
- **Express over NestJS:** For a focused API, NestJS's boilerplate is overkill. Express keeps the routing visible and straightforward.
- **Vanilla CSS over Tailwind:** CSS Custom Properties provide a robust design token system without a build step or bloated HTML classes, keeping components perfectly readable.

---

## 🚧 Challenges Faced

### 1. Prisma Limitations with Row Locks
Prisma's query builder does not support `FOR UPDATE` natively. The solution required dropping into a raw query (`$queryRaw`) just for the lock step, then continuing the rest of the transaction with Prisma's typed API. It's a small compromise (one raw SQL string) in exchange for absolute concurrency safety.

### 2. Waitlist Context Awareness
Handling the UX when a user clicks a seat, takes 30 seconds to type their name, and hits "Confirm" only to find out someone else took the seat 5 seconds ago. Catching the `409 Conflict` gracefully required making an immediate subsequent check to seat availability to determine if the train was entirely full (show "Join Waitlist") or if only that specific seat was taken (show "Choose Another Seat" AND "Join Waitlist for This Seat").

### 3. Docker Networking
The React app is served by nginx inside Docker. The browser, however, is outside Docker. When the browser makes an API call, it cannot reach `backend:4000` (the internal Docker hostname). The solution involved configuring nginx to listen for `/api/*` requests on port 8080 and forward them internally to `backend:4000`, completely abstracting the backend address from the browser and bypassing CORS issues entirely.