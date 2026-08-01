import React, { useState } from 'react';
import Header from './components/Header';
import StepIndicator from './components/StepIndicator';
import RouteSelect from './components/RouteSelect';
import SeatMap from './components/SeatMap';
import PassengerForm from './components/PassengerForm';
import BookingConfirmation from './components/BookingConfirmation';
import type { Station, SeatAvailability, Booking, BookingStep } from './types';

const App: React.FC = () => {
  // ── Booking flow state ────────────────────────────────────────────────────
  const [step,          setStep]          = useState<BookingStep>('SELECT_ROUTE');
  const [fromStation,   setFromStation]   = useState<Station | null>(null);
  const [toStation,     setToStation]     = useState<Station | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number>(0);
  const [selectedSeat,  setSelectedSeat]  = useState<SeatAvailability | null>(null);
  const [booking,       setBooking]       = useState<Booking | null>(null);

  // ── Step handlers ─────────────────────────────────────────────────────────
  const handleRouteSelected = (from: Station, to: Station, fare: number) => {
    setFromStation(from);
    setToStation(to);
    setEstimatedFare(fare);
    setSelectedSeat(null);
    setStep('SELECT_SEAT');
  };

  const handleSeatSelected = (seat: SeatAvailability) => {
    setSelectedSeat(seat);
    setStep('PASSENGER_DETAILS');
  };

  const handleBooked = (b: Booking) => {
    setBooking(b);
    setStep('CONFIRMATION');
  };

  const handleReset = () => {
    setStep('SELECT_ROUTE');
    setFromStation(null);
    setToStation(null);
    setSelectedSeat(null);
    setBooking(null);
  };

  return (
    <>
      <Header />

      <main className="main-content">
        <div className="container">

          {/* Hero */}
          {step === 'SELECT_ROUTE' && (
            <section className="hero" aria-label="Hero section">
              <div className="hero-eyebrow">Sri Lanka Railways</div>
              <h1 className="hero-title">
                Book Smarter.<br />
                Travel on <span>Your Segment</span>.
              </h1>
              <p className="hero-subtitle">
                The Colombo Fort–Badulla upcountry line lets you reserve a seat
                for exactly the distance you travel — no more paying for empty
                seats you never use.
              </p>
              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="hero-stat-value">40</span>
                  <span className="hero-stat-label">Stations</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-value">292 km</span>
                  <span className="hero-stat-label">Route Length</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-value">3</span>
                  <span className="hero-stat-label">Reserved Coaches</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-value">144</span>
                  <span className="hero-stat-label">Bookable Seats</span>
                </div>
              </div>
            </section>
          )}

          {/* Step indicator */}
          {step !== 'SELECT_ROUTE' && (
            <StepIndicator currentStep={step} />
          )}

          {/* Booking flow */}
          <div className="booking-layout">

            {step === 'SELECT_ROUTE' && (
              <RouteSelect onRouteSelected={handleRouteSelected} />
            )}

            {step === 'SELECT_SEAT' && fromStation && toStation && (
              <>
                <SeatMap
                  fromStation={fromStation}
                  toStation={toStation}
                  selectedSeatId={selectedSeat?.seatId ?? null}
                  onSeatSelect={handleSeatSelected}
                />
                {/* Selected seat indicator */}
                {selectedSeat && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div className="selected-seat-badge">
                      ✓ Coach {selectedSeat.coachName} · Seat {selectedSeat.seatNumber}
                    </div>
                    <button
                      id="proceed-to-details-btn"
                      className="btn btn-primary btn-lg"
                      onClick={() => setStep('PASSENGER_DETAILS')}
                    >
                      Continue →
                    </button>
                  </div>
                )}
                <div>
                  <button
                    id="back-to-route-btn"
                    className="btn btn-outline"
                    onClick={() => setStep('SELECT_ROUTE')}
                  >
                    ← Change Route
                  </button>
                </div>
              </>
            )}

            {step === 'PASSENGER_DETAILS' && fromStation && toStation && selectedSeat && (
              <PassengerForm
                fromStation={fromStation}
                toStation={toStation}
                selectedSeat={selectedSeat}
                estimatedFare={estimatedFare}
                onBooked={handleBooked}
                onBack={() => setStep('SELECT_SEAT')}
              />
            )}

            {step === 'CONFIRMATION' && booking && (
              <BookingConfirmation
                booking={booking}
                onBookAnother={handleReset}
              />
            )}

          </div>
        </div>
      </main>
    </>
  );
};

export default App;
