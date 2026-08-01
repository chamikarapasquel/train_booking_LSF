import React, { useState } from 'react';
import { createBooking } from '../api/client';
import type { Station, SeatAvailability, Booking } from '../types';

interface PassengerFormProps {
  fromStation: Station;
  toStation: Station;
  selectedSeat: SeatAvailability;
  estimatedFare: number;
  onBooked: (booking: Booking) => void;
  onBack: () => void;
}

const PassengerForm: React.FC<PassengerFormProps> = ({
  fromStation,
  toStation,
  selectedSeat,
  estimatedFare,
  onBooked,
  onBack,
}) => {
  const [name,      setName]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const booking = await createBooking({
        seatId:        selectedSeat.seatId,
        fromStationId: fromStation.id,
        toStationId:   toStation.id,
        passengerName: name.trim(),
      });
      onBooked(booking);
    } catch (err: unknown) {
      // Distinguish between a booking conflict (409) and other errors
      const message =
        err instanceof Error ? err.message : 'Booking failed. Please try again.';
      setError(message);

      // If it's a conflict, the seat was just taken. Show a specific note.
      const errWithStatus = err as { status?: number };
      if (errWithStatus.status === 409) {
        setError(`${message} — Please go back and select another seat.`);
      }
    } finally {
      setLoading(false);
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

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          ⚠ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group mb-6">
          <label className="form-label" htmlFor="passenger-name">
            Full Name
          </label>
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
            disabled={loading}
          >
            ← Back
          </button>
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
        </div>
      </form>
    </div>
  );
};

export default PassengerForm;
