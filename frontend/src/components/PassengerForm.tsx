import React, { useState } from 'react';
import { createBooking, joinWaitlist, fetchSeatAvailability } from '../api/client';
import type { Station, SeatAvailability, Booking, WaitlistEntry } from '../types';

interface PassengerFormProps {
  fromStation:   Station;
  toStation:     Station;
  selectedSeat:  SeatAvailability;
  estimatedFare: number;
  onBooked:      (booking: Booking) => void;
  onWaitlisted:  (entry: WaitlistEntry) => void;
  onBack:        () => void;
}

const PassengerForm: React.FC<PassengerFormProps> = ({
  fromStation,
  toStation,
  selectedSeat,
  estimatedFare,
  onBooked,
  onWaitlisted,
  onBack,
}) => {
  const [name,          setName]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [seatFull,      setSeatFull]      = useState(false);
  const [waitlisting,   setWaitlisting]   = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [availableSeatCount, setAvailableSeatCount] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSeatFull(false);
    setWaitlistError(null);

    try {
      const booking = await createBooking({
        seatId:        selectedSeat.seatId,
        fromStationId: fromStation.id,
        toStationId:   toStation.id,
        passengerName: name.trim(),
      });
      onBooked(booking);
    } catch (err: unknown) {
      const errWithStatus = err as { status?: number; message?: string };
      if (errWithStatus.status === 409) {
        try {
          const seats = await fetchSeatAvailability(fromStation.id, toStation.id);
          const availableCount = seats.filter(s => s.available).length;
          setAvailableSeatCount(availableCount);
        } catch {
          setAvailableSeatCount(null); // Fallback
        }
        setSeatFull(true);
      } else {
        setError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!name.trim()) return;
    setWaitlisting(true);
    setWaitlistError(null);
    try {
      const entry = await joinWaitlist({
        fromStationId: fromStation.id,
        toStationId:   toStation.id,
        passengerName: name.trim(),
      });
      onWaitlisted(entry);
    } catch (err: unknown) {
      setWaitlistError(err instanceof Error ? err.message : 'Could not join waitlist. Please try again.');
    } finally {
      setWaitlisting(false);
    }
  };

  return (
    <div className="card animate-in">
      <div className="card-title">
        <div className="card-title-icon">👤</div>
        Passenger Details
      </div>

      {/* Journey summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-4)',
          padding: 'var(--space-4)',
          background: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>From</div>
          <div style={{ fontWeight: 600 }}>{fromStation.name}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>To</div>
          <div style={{ fontWeight: 600 }}>{toStation.name}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Seat</div>
          <div style={{ fontWeight: 600 }}>Coach {selectedSeat.coachName} · {selectedSeat.seatNumber}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Fare</div>
          <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.1rem' }}>LKR {estimatedFare.toFixed(2)}</div>
        </div>
      </div>

      {/* Generic error */}
      {error && (
        <div className="alert alert-error mb-4" role="alert">⚠ {error}</div>
      )}

      {/* Seat-full amber waitlist banner */}
      {seatFull && (
        <div className="alert alert-waitlist mb-4" role="alert" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <div>
            {availableSeatCount === 0 ? (
              <>
                <strong>😔 That seat was just taken!</strong>
                <p style={{ fontSize: '0.85rem', marginTop: 4, opacity: 0.9 }}>
                  All seats for <strong>{fromStation.name} → {toStation.name}</strong> are currently full.
                  Join the waitlist and we'll automatically confirm your booking the moment a seat opens up.
                </p>
              </>
            ) : (
              <>
                <strong>😔 Seat {selectedSeat.coachName} · {selectedSeat.seatNumber} is taken!</strong>
                <p style={{ fontSize: '0.85rem', marginTop: 4, opacity: 0.9 }}>
                  This seat was just booked by someone else. You can join the waitlist for seat{' '}
                  <strong>{selectedSeat.coachName} · {selectedSeat.seatNumber}</strong> and we'll
                  automatically confirm you if it opens up — or go back and pick a different seat.
                </p>
              </>
            )}
            {waitlistError && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.82rem', marginTop: 6 }}>
                {waitlistError}
              </p>
            )}
          </div>
          <div className="flex gap-4 flex-wrap">
            <button
              id="join-waitlist-btn"
              className="btn btn-waitlist"
              onClick={handleJoinWaitlist}
              disabled={!name.trim() || waitlisting}
            >
              {waitlisting ? (
                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Joining…</>
              ) : availableSeatCount === 0 ? (
                '⏳ Join Waitlist'
              ) : (
                '⏳ Join Waitlist for This Seat'
              )}
            </button>
            {availableSeatCount !== 0 && (
              <button
                id="choose-another-seat-btn"
                className="btn btn-outline"
                onClick={onBack}
                disabled={waitlisting}
              >
                💺 Choose Another Seat
              </button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group mb-6">
          <label className="form-label" htmlFor="passenger-name">Full Name</label>
          <input
            id="passenger-name"
            type="text"
            className="form-input"
            placeholder="e.g. Arun Perera"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            autoFocus
          />
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            id="back-to-seat-btn"
            className="btn btn-outline"
            onClick={onBack}
            disabled={loading || waitlisting}
          >
            ← Back
          </button>
          {!seatFull && (
            <button
              type="submit"
              id="confirm-booking-btn"
              className="btn btn-primary btn-lg"
              disabled={!name.trim() || loading}
              style={{ flex: 1 }}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Confirming…</>
              ) : (
                '✓ Confirm Booking'
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PassengerForm;
