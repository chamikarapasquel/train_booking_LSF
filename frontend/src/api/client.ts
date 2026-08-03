/**
 * api/client.ts — typed wrappers around every backend endpoint.
 *
 * All requests go to /api/... (relative URL) so:
 *  - In dev: Vite's proxy forwards to http://localhost:4000
 *  - In Docker: nginx forwards to http://backend:4000
 * No environment-specific URL needed in the code.
 */

import type { Station, Coach, SeatAvailability, Booking, WaitlistEntry } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const body = await res.json();

  if (!res.ok) {
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code   = body?.error?.code;
    error.status = res.status;
    throw error;
  }

  return body as T;
}

// ── Stations ─────────────────────────────────────────────────────────────────

export async function fetchStations(): Promise<Station[]> {
  const data = await request<{ stations: Station[] }>('/stations');
  return data.stations;
}

// ── Coaches ──────────────────────────────────────────────────────────────────

export async function fetchCoaches(): Promise<Coach[]> {
  const data = await request<{ coaches: Coach[] }>('/coaches');
  return data.coaches;
}

// ── Seat Availability ─────────────────────────────────────────────────────────

export async function fetchSeatAvailability(
  fromStationId: string,
  toStationId: string,
): Promise<SeatAvailability[]> {
  const params = new URLSearchParams({ fromStationId, toStationId });
  const data = await request<{ seats: SeatAvailability[] }>(`/seats/availability?${params}`);
  return data.seats;
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export async function createBooking(payload: {
  seatId: string;
  fromStationId: string;
  toStationId: string;
  passengerName: string;
}): Promise<Booking> {
  const data = await request<{ booking: Booking }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.booking;
}

export async function fetchBooking(bookingId: string): Promise<Booking> {
  const data = await request<{ booking: Booking }>(`/bookings/${bookingId}`);
  return data.booking;
}

export async function cancelBooking(bookingId: string): Promise<Booking> {
  const data = await request<{ booking: Booking }>(`/bookings/${bookingId}`, {
    method: 'DELETE',
  });
  return data.booking;
}

// ── Waitlist ──────────────────────────────────────────────────────────────────

export async function joinWaitlist(payload: {
  fromStationId: string;
  toStationId:   string;
  passengerName: string;
}): Promise<WaitlistEntry> {
  const data = await request<{ entry: WaitlistEntry }>('/waitlist', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.entry;
}

export async function fetchWaitlistEntry(entryId: string): Promise<WaitlistEntry> {
  const data = await request<{ entry: WaitlistEntry }>(`/waitlist/${entryId}`);
  return data.entry;
}

export async function cancelWaitlistEntry(entryId: string): Promise<WaitlistEntry> {
  const data = await request<{ entry: WaitlistEntry }>(`/waitlist/${entryId}`, {
    method: 'DELETE',
  });
  return data.entry;
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalRevenue: number;
  activeBookings: number;
  waitlistedPassengers: number;
  totalSeats: number;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  return request<AdminStats>('/admin/stats');
}
