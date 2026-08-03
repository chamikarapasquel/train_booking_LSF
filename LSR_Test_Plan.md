# Lanka Scenic Rail - Comprehensive Test Plan

This document contains a comprehensive set of test cases for all features, components, and edge cases in the Lanka Scenic Rail segment booking system. 

The tests are organized by module and prioritized by risk level (🔴 High, 🟡 Medium, 🟢 Low).

---

## 1. Seat Availability & Overlap Logic
*Core logic for half-open interval booking [from, to). These tests ensure passengers can book empty segments without conflicts.*

| Priority | Test Name | Scenario | Preconditions | Steps | Expected Result | Type |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 🔴 | Completely Free Seat | Checking availability for an unbooked seat. | Seat 1A has no bookings. | Query availability for Station A → C. | Seat 1A is marked as `available`. | Unit/Int |
| 🔴 | Back-to-Back Booking (Departure) | Booking starts exactly when another ends. | Seat 1A booked A → B. | Query availability for Station B → C. | Seat 1A is marked as `available` (no conflict). | Unit/Int |
| 🔴 | Back-to-Back Booking (Arrival) | Booking ends exactly when another starts. | Seat 1A booked B → C. | Query availability for Station A → B. | Seat 1A is marked as `available` (no conflict). | Unit/Int |
| 🔴 | Overlapping Booking (Inside) | New booking falls entirely inside an existing one. | Seat 1A booked A → D. | Query availability for Station B → C. | Seat 1A is marked as `unavailable`. | Unit/Int |
| 🔴 | Overlapping Booking (Partial overlap) | New booking partially overlaps an existing one. | Seat 1A booked A → C. | Query availability for Station B → D. | Seat 1A is marked as `unavailable`. | Unit/Int |
| 🔴 | Exact Match Booking | New booking matches existing booking exactly. | Seat 1A booked A → C. | Query availability for Station A → C. | Seat 1A is marked as `unavailable`. | Unit/Int |
| 🟡 | Cancelled Booking Ignored | Availability should ignore cancelled bookings. | Seat 1A booked A → C, but status is `CANCELLED`. | Query availability for Station A → C. | Seat 1A is marked as `available`. | Unit/Int |
| 🟢 | Unreserved Coach Excluded | Unreserved coaches shouldn't appear in specific seat availability. | Coach "U1" is UNRESERVED. | Query availability. | Only RESERVED coach seats are returned. | Unit/Int |

---

## 2. Booking Process & Concurrency
*Ensuring bookings are atomic and double-booking is prevented under heavy load.*

| Priority | Test Name | Scenario | Preconditions | Steps | Expected Result | Type |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 🔴 | Successful Booking | User books a free seat. | Seat 1A is available for A → B. | Submit booking for 1A, A → B with valid name. | Booking created with status `CONFIRMED`, correct fare calculated. | Int |
| 🔴 | Concurrent Booking (Pessimistic Lock) | Two users try to book the exact same seat simultaneously. | Seat 1A is available A → B. | Fire two concurrent API requests to book Seat 1A for A → B. | One request succeeds. The other returns 409 Conflict. | Int |
| 🔴 | Validation: Destination before Origin | User tries to book backwards. | Stations A (order 0), B (order 1). | Submit booking from B → A. | 400 Bad Request: Origin must come before destination. | API |
| 🔴 | Validation: Same Origin and Destination | User books 0-distance leg. | - | Submit booking from A → A. | 400 Bad Request: Origin must come before destination. | API |
| 🟡 | Validation: Empty Passenger Name | Form submitted without name. | Seat 1A is available. | Submit booking with empty/whitespace name. | 400 Bad Request: Passenger name is required. | API |
| 🟡 | Invalid Seat ID | User books a non-existent seat. | - | Submit booking with bogus seat ID. | 404 Not Found: Seat not found. | API |
| 🟡 | Unreserved Seat Booking | User tries to book an unreserved seat. | Seat is in UNRESERVED coach. | Submit booking for seat. | 400 Bad Request: Only reserved coach seats can be individually booked. | API |

---

## 3. Cancellations & Admin Dashboard
*Testing soft-delete functionality and admin controls.*

| Priority | Test Name | Scenario | Preconditions | Steps | Expected Result | Type |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 🔴 | Successful Cancellation | Admin cancels a booking. | Booking #123 exists and is `CONFIRMED`. No waitlist exists. | Call cancel API for #123. | Booking status changes to `CANCELLED`. Seat becomes available again. | Int |
| 🟡 | Double Cancellation | Admin cancels an already cancelled booking. | Booking #123 is `CANCELLED`. | Call cancel API for #123. | 409 Conflict: Booking is already cancelled. | API |
| 🟡 | Invalid Booking ID | Admin cancels non-existent booking. | - | Call cancel API with bogus ID. | 404 Not Found: Booking not found. | API |
| 🟢 | Admin Dashboard View | Admin views all bookings. | Database has CONFIRMED and CANCELLED bookings. | Load Admin Dashboard. | List displays all bookings with correct statuses and fare amounts. | E2E |

---

## 4. Waitlist & Auto-Promotion
*When the train is full, users join the waitlist. If someone cancels, the queue automatically promotes the first eligible passenger.*

| Priority | Test Name | Scenario | Preconditions | Steps | Expected Result | Type |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 🔴 | Join Waitlist | User joins waitlist when seats are full. | All seats for A → B are occupied. | Submit waitlist request for A → B. | WaitlistEntry created with status `WAITING` and correct queue position. | Int |
| 🔴 | Auto-Promotion Exact Match | Confirmed booking cancelled, waitlist matches leg exactly. | Booking1 (A→B) CONFIRMED. Waitlist1 (A→B) WAITING. | Cancel Booking1. | Waitlist1 promoted to CONFIRMED booking. Waitlist1 status becomes `PROMOTED`. | Int |
| 🔴 | Auto-Promotion Partial Match | Cancelled booking covers waitlisted leg. | Booking1 (A→C) CONFIRMED. Waitlist1 (A→B) WAITING. | Cancel Booking1. | Waitlist1 promoted to CONFIRMED booking. (Seat is free for A→C, so A→B is allowed). | Int |
| 🔴 | Promotion Fails due to Conflict | Cancelled booking doesn't cover enough of the waitlisted leg. | Booking1 (A→B) CONFIRMED. Booking2 (B→C) CONFIRMED. Waitlist1 (A→C) WAITING. | Cancel Booking1. | Waitlist1 remains `WAITING` because B→C is still blocked by Booking2. | Int |
| 🟡 | Queue Order Respected | Multiple people on waitlist for same leg. | Waitlist1 (position 1), Waitlist2 (position 2) for A→B. Booking1 (A→B) cancelled. | Cancel Booking1. | Waitlist1 is promoted. Waitlist2 remains `WAITING`. | Int |
| 🟡 | Promotion Assigns Correct Seat | Waitlisted user should get the exact seat that was freed. | Seat 1A freed. | Cancel Booking for 1A. | New booking for promoted user is explicitly assigned to Seat 1A. | Int |

---

## 5. Fares & Calculations
*Ensuring financial math is accurate.*

| Priority | Test Name | Scenario | Preconditions | Steps | Expected Result | Type |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 🔴 | Standard Fare Calculation | Calculate fare for a multi-station leg. | Station A (10km), Station B (50km). Rate = 2.0. | Book A → B. | Fare amount is (50 - 10) * 2.0 = 80.0 LKR. | Unit |
| 🔴 | Waitlist Fare Pre-calculation | Fare is calculated and locked when joining waitlist. | Station A (10km), Station B (50km). | Join Waitlist A → B. | WaitlistEntry has `fareAmount` = 80.0 LKR. | Int |
| 🟡 | Fractional Distances | Stations with fractional distances. | Station A (10.5km), Station B (20.7km). Rate = 10. | Book A → B. | Fare amount is exactly 102.0 LKR (handling float precision). | Unit |

---

## 6. Frontend & User Interface
*Testing the React SPA and state machine flow.*

| Priority | Test Name | Scenario | Preconditions | Steps | Expected Result | Type |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 🔴 | E2E Booking Flow | Full booking happy path. | Database seeded. | 1. Select A→B. <br> 2. Pick available seat. <br> 3. Enter name. <br> 4. Confirm. | Success screen shows booking ID and details. | E2E |
| 🔴 | E2E Waitlist Flow | Full waitlist happy path. | Leg A→B is completely booked. | 1. Select A→B. <br> 2. See "No seats available". <br> 3. Click "Join Waitlist". <br> 4. Enter name & submit. | Success screen shows waitlist position. | E2E |
| 🟡 | Form Validation (Route) | Cannot proceed without stations. | On RouteSelect step. | Click "Next" without selecting destination. | Next button is disabled or shows validation error. | UI |
| 🟡 | Seat Map Updates | Changing stations refreshes the seat map. | At SeatMap step. | Go back, change destination, go forward. | Seat map fetches new availability data and reflects changes. | UI |
| 🟡 | Concurrent Seat Steal (UI) | Seat taken while user is filling form. | User selects 1A, moves to form. | Another user books 1A via API. User submits form. | API returns 409 Conflict. UI displays error asking user to select another seat. | E2E |
| 🟢 | Responsive Layout | App renders on mobile. | - | Resize window to 375px wide. | Seat map scrolls horizontally, header and forms stack neatly. | UI |

---

## 7. Edge Cases & Boundary Conditions

| Priority | Test Name | Scenario | Preconditions | Steps | Expected Result | Type |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 🟡 | First to Last Station | User books the entire route (Colombo to Badulla). | Route has 40 stations. | Book station 0 → 39. | Books successfully. Blocks all other bookings for that seat. | Int |
| 🟡 | Waitlist Promotion Cascade | One cancellation frees up space for multiple shorter waitlisted legs. | Booking1 (A→D) cancelled. Waitlist1 (A→B), Waitlist2 (B→C). | Cancel Booking1. | Waitlist1 AND Waitlist2 are both promoted. (Requires checking if logic loops through waitlist until seat is full again). | Int/Edge |
| 🟢 | Massive Load / DB Timeouts | Database under heavy load handling locks. | - | Send 100 concurrent requests for 100 different seats. | All succeed without locking timeouts. (Row-level lock only blocks same-seat). | Load |
