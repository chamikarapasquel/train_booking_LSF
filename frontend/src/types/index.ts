// Shared TypeScript types — mirroring the API response shapes.
// Keeping these in one place means if the API changes, you update one file.

export interface Station {
  id: string;
  name: string;
  order: number;
  distanceKm: number;
}

export interface Coach {
  id: string;
  name: string;
  type: 'RESERVED' | 'UNRESERVED';
  capacity: number;
}

export interface SeatAvailability {
  seatId: string;
  seatNumber: string;
  coachId: string;
  coachName: string;
  available: boolean;
}

export interface Booking {
  id: string;
  seatId: string;
  seatNumber: string;
  coachName: string;
  fromStation: { id: string; name: string; order: number };
  toStation:   { id: string; name: string; order: number };
  passengerName: string;
  fareAmount: number;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
}

export interface WaitlistEntry {
  id:                string;
  passengerName:     string;
  fromStation:       { id: string; name: string; order: number };
  toStation:         { id: string; name: string; order: number };
  fareAmount:        number;
  position:          number;
  queueAhead:        number;
  status:            'WAITING' | 'PROMOTED' | 'CANCELLED';
  promotedBookingId: string | null;
  createdAt:         string;
}

// Application-level booking flow state
export type BookingStep =
  | 'SELECT_ROUTE'
  | 'SELECT_SEAT'
  | 'PASSENGER_DETAILS'
  | 'CONFIRMATION'
  | 'WAITLIST_CONFIRMATION';
