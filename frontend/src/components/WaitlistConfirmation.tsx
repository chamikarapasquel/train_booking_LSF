import React, { useEffect, useRef, useState } from 'react';
import { fetchWaitlistEntry, cancelWaitlistEntry, fetchBooking } from '../api/client';
import type { WaitlistEntry, Booking } from '../types';

interface WaitlistConfirmationProps {
  entry:         WaitlistEntry;
  onBookAnother: () => void;
}

const POLL_INTERVAL_MS = 10_000; // poll every 10 s

const WaitlistConfirmation: React.FC<WaitlistConfirmationProps> = ({ entry: initialEntry, onBookAnother }) => {
  const [entry,           setEntry]           = useState(initialEntry);
  const [promotedBooking, setPromotedBooking] = useState<Booking | null>(null);
  const [cancelling,      setCancelling]      = useState(false);
  const [cancelError,     setCancelError]     = useState<string | null>(null);
  const [cancelConfirm,   setCancelConfirm]   = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling: check every 10 s until promoted or cancelled ──────────────────
  useEffect(() => {
    if (entry.status !== 'WAITING') return;

    const poll = async () => {
      try {
        const updated = await fetchWaitlistEntry(entry.id);
        setEntry(updated);

        if (updated.status === 'PROMOTED' && updated.promotedBookingId) {
          // Fetch the real booking so we can show full ticket details
          try {
            const booking = await fetchBooking(updated.promotedBookingId);
            setPromotedBooking(booking);
          } catch { /* non-critical — entry data is enough */ }
          clearInterval(intervalRef.current!);
        } else if (updated.status === 'CANCELLED') {
          clearInterval(intervalRef.current!);
        }
      } catch { /* swallow poll errors — try again next tick */ }
    };

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current!);
  }, [entry.id, entry.status]);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await cancelWaitlistEntry(entry.id);
      setEntry(updated);
      setCancelConfirm(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Could not cancel. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  // ── Promoted view ──────────────────────────────────────────────────────────
  if (entry.status === 'PROMOTED') {
    return (
      <div className="animate-in">
        <div className="alert alert-success mb-6" role="status">
          🎉 Great news! A seat just opened up — you're now confirmed!
        </div>

        <div className="waitlist-card promoted">
          <div className="waitlist-promoted-header">
            <div className="waitlist-promoted-icon">🎟️</div>
            <div>
              <div className="waitlist-promoted-title">You're In!</div>
              <div className="waitlist-promoted-sub">Your booking has been confirmed automatically</div>
            </div>
          </div>

          <div className="waitlist-detail-grid">
            <div className="waitlist-detail-item">
              <div className="waitlist-detail-label">Passenger</div>
              <div className="waitlist-detail-value">{entry.passengerName}</div>
            </div>
            <div className="waitlist-detail-item">
              <div className="waitlist-detail-label">From</div>
              <div className="waitlist-detail-value">{entry.fromStation.name}</div>
            </div>
            <div className="waitlist-detail-item">
              <div className="waitlist-detail-label">To</div>
              <div className="waitlist-detail-value">{entry.toStation.name}</div>
            </div>
            <div className="waitlist-detail-item">
              <div className="waitlist-detail-label">Fare (LKR)</div>
              <div className="waitlist-detail-value highlight">{entry.fareAmount.toFixed(2)}</div>
            </div>
            {promotedBooking && (
              <div className="waitlist-detail-item">
                <div className="waitlist-detail-label">Seat</div>
                <div className="waitlist-detail-value">
                  Coach {promotedBooking.coachName} · {promotedBooking.seatNumber}
                </div>
              </div>
            )}
          </div>

          {entry.promotedBookingId && (
            <div className="waitlist-id-row">
              <div className="waitlist-id-label">Booking ID</div>
              <div className="waitlist-id-value">{entry.promotedBookingId}</div>
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-6">
          <button id="waitlist-book-another-btn" className="btn btn-primary" onClick={onBookAnother}>
            + Book Another Seat
          </button>
        </div>
      </div>
    );
  }

  // ── Cancelled view ─────────────────────────────────────────────────────────
  if (entry.status === 'CANCELLED') {
    return (
      <div className="animate-in">
        <div className="alert alert-error mb-6" role="status">
          ✕ You've left the waitlist for this segment.
        </div>
        <div className="flex gap-4 mt-4">
          <button id="waitlist-cancelled-book-btn" className="btn btn-primary" onClick={onBookAnother}>
            + Try Another Route or Seat
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting view (default) ─────────────────────────────────────────────────
  const positionLabel = entry.queueAhead === 0
    ? '1st in line 🥇'
    : `#${entry.queueAhead + 1} in queue`;

  return (
    <div className="animate-in">
      <div className="alert alert-waitlist mb-6" role="status">
        ⏳ You're on the waitlist! We'll notify you automatically when a seat opens.
      </div>

      <div className="waitlist-card">
        {/* Position badge */}
        <div className="waitlist-position-row">
          <div className="waitlist-position-ring">
            <div className="waitlist-position-inner">
              <div className="waitlist-position-num">{entry.queueAhead + 1}</div>
              <div className="waitlist-position-of">in line</div>
            </div>
          </div>
          <div>
            <div className="waitlist-position-label">{positionLabel}</div>
            <div className="waitlist-position-sub">
              Checking for open seats every 10 s
              <span className="waitlist-pulse-dot" />
            </div>
          </div>
        </div>

        {/* Journey details */}
        <div className="waitlist-detail-grid">
          <div className="waitlist-detail-item">
            <div className="waitlist-detail-label">Passenger</div>
            <div className="waitlist-detail-value">{entry.passengerName}</div>
          </div>
          <div className="waitlist-detail-item">
            <div className="waitlist-detail-label">From</div>
            <div className="waitlist-detail-value">{entry.fromStation.name}</div>
          </div>
          <div className="waitlist-detail-item">
            <div className="waitlist-detail-label">To</div>
            <div className="waitlist-detail-value">{entry.toStation.name}</div>
          </div>
          <div className="waitlist-detail-item">
            <div className="waitlist-detail-label">Fare (LKR)</div>
            <div className="waitlist-detail-value highlight">{entry.fareAmount.toFixed(2)}</div>
          </div>
        </div>

        {/* Waitlist ID */}
        <div className="waitlist-id-row">
          <div className="waitlist-id-label">Waitlist ID</div>
          <div className="waitlist-id-value">{entry.id}</div>
        </div>

        <div className="waitlist-note">
          If a confirmed passenger cancels their booking, you'll be automatically
          assigned a seat and your booking will be confirmed instantly.
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mt-6 flex-wrap">
        <button id="waitlist-book-another-btn" className="btn btn-outline" onClick={onBookAnother}>
          ← Back to Route Selection
        </button>

        {!cancelConfirm && (
          <button
            id="waitlist-leave-btn"
            className="btn btn-waitlist"
            onClick={() => setCancelConfirm(true)}
          >
            Leave Queue
          </button>
        )}
      </div>

      {/* Cancel confirm */}
      {cancelConfirm && (
        <div className="alert alert-error mt-4" role="alertdialog">
          <div>
            <strong>Leave the waitlist?</strong>
            <p style={{ fontSize: '0.85rem', marginTop: 4, opacity: 0.85 }}>
              Your spot will be released. This cannot be undone.
            </p>
            {cancelError && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: 4 }}>
                {cancelError}
              </p>
            )}
            <div className="flex gap-4 mt-4">
              <button
                id="waitlist-confirm-leave-btn"
                className="btn btn-danger"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Leaving…' : 'Yes, Leave'}
              </button>
              <button
                id="waitlist-abort-leave-btn"
                className="btn btn-outline"
                onClick={() => setCancelConfirm(false)}
                disabled={cancelling}
              >
                Stay in Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaitlistConfirmation;
