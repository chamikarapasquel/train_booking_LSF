import React, { useState } from 'react';
import { cancelBooking } from '../api/client';
import type { Booking } from '../types';

interface BookingConfirmationProps {
  booking: Booking;
  onBookAnother: () => void;
}

const BookingConfirmation: React.FC<BookingConfirmationProps> = ({ booking: initialBooking, onBookAnother }) => {
  const [booking,         setBooking]         = useState(initialBooking);
  const [cancelling,      setCancelling]      = useState(false);
  const [cancelError,     setCancelError]     = useState<string | null>(null);
  const [cancelConfirm,   setCancelConfirm]   = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await cancelBooking(booking.id);
      setBooking(updated);
      setCancelConfirm(false);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  const isConfirmed = booking.status === 'CONFIRMED';

  return (
    <div className="animate-in">
      {/* Status banner */}
      {isConfirmed ? (
        <div className="alert alert-success mb-6" role="status">
          🎉 Your seat is reserved! Save your booking ID below.
        </div>
      ) : (
        <div className="alert alert-error mb-6" role="status">
          ✕ This booking has been cancelled.
        </div>
      )}

      {/* Ticket */}
      <div className="ticket">
        <div className="ticket-header">
          <div className={`ticket-status ${isConfirmed ? 'confirmed' : 'cancelled'}`}>
            {isConfirmed ? '● Confirmed' : '✕ Cancelled'}
          </div>
          <div className="ticket-route">
            <div className="ticket-station">
              <div className="ticket-station-label">From</div>
              <div className="ticket-station-name">{booking.fromStation.name}</div>
            </div>
            <div className="ticket-route-line">
              <div className="ticket-route-dot" />
              <div className="ticket-route-track" />
              <div className="ticket-route-dot" />
            </div>
            <div className="ticket-station" style={{ textAlign: 'right' }}>
              <div className="ticket-station-label">To</div>
              <div className="ticket-station-name">{booking.toStation.name}</div>
            </div>
          </div>
        </div>

        <div className="ticket-body">
          <div className="ticket-grid">
            <div className="ticket-field">
              <div className="ticket-field-label">Passenger</div>
              <div className="ticket-field-value">{booking.passengerName}</div>
            </div>
            <div className="ticket-field">
              <div className="ticket-field-label">Coach</div>
              <div className="ticket-field-value">{booking.coachName}</div>
            </div>
            <div className="ticket-field">
              <div className="ticket-field-label">Seat</div>
              <div className="ticket-field-value">{booking.seatNumber}</div>
            </div>
            <div className="ticket-field">
              <div className="ticket-field-label">Fare (LKR)</div>
              <div className="ticket-field-value highlight">
                {booking.fareAmount.toFixed(2)}
              </div>
            </div>
            <div className="ticket-field">
              <div className="ticket-field-label">Booked On</div>
              <div className="ticket-field-value">
                {new Date(booking.createdAt).toLocaleDateString('en-LK', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </div>
            </div>
            <div className="ticket-field">
              <div className="ticket-field-label">Status</div>
              <div className={`ticket-field-value ${isConfirmed ? 'text-success' : 'text-danger'}`}>
                {isConfirmed ? 'Confirmed' : 'Cancelled'}
              </div>
            </div>
          </div>
        </div>

        <div className="ticket-footer">
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)', marginBottom: 2 }}>Booking ID</div>
            <div className="ticket-id">{booking.id}</div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
            Lanka Scenic Rail · Segment Booking System
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mt-6 flex-wrap">
        <button
          id="book-another-btn"
          className="btn btn-primary"
          onClick={onBookAnother}
        >
          + Book Another Seat
        </button>

        {isConfirmed && !cancelConfirm && (
          <button
            id="cancel-booking-btn"
            className="btn btn-outline"
            onClick={() => setCancelConfirm(true)}
          >
            Cancel Booking
          </button>
        )}
      </div>

      {/* Cancel confirmation */}
      {cancelConfirm && (
        <div className="alert alert-error mt-4" role="alertdialog" aria-modal="true">
          <div>
            <strong>Cancel this booking?</strong>
            <p style={{ fontSize: '0.85rem', marginTop: 4, opacity: 0.85 }}>
              This will free the seat segment for other passengers. This cannot be undone.
            </p>
            {cancelError && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: 4 }}>
                {cancelError}
              </p>
            )}
            <div className="flex gap-4 mt-4">
              <button
                id="confirm-cancel-btn"
                className="btn btn-danger"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
              <button
                id="abort-cancel-btn"
                className="btn btn-outline"
                onClick={() => setCancelConfirm(false)}
                disabled={cancelling}
              >
                Keep Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingConfirmation;
