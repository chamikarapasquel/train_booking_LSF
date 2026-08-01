import React, { useEffect, useState } from 'react';
import { fetchStations } from '../api/client';
import type { Station } from '../types';
import { config } from '../config';

interface RouteSelectProps {
  onRouteSelected: (from: Station, to: Station, fare: number) => void;
}

const RouteSelect: React.FC<RouteSelectProps> = ({ onRouteSelected }) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [fromId,   setFromId]   = useState('');
  const [toId,     setToId]     = useState('');

  useEffect(() => {
    fetchStations()
      .then(setStations)
      .catch(() => setError('Could not load stations. Is the server running?'))
      .finally(() => setLoading(false));
  }, []);

  const fromStation = stations.find((s) => s.id === fromId) ?? null;
  const toStation   = stations.find((s) => s.id === toId)   ?? null;

  // Destination options: only stations that come AFTER the selected origin
  const destinationOptions = fromStation
    ? stations.filter((s) => s.order > fromStation.order)
    : stations.filter((_s, i) => i > 0); // at least one station ahead

  // Preview fare
  const previewFare =
    fromStation && toStation
      ? ((toStation.distanceKm - fromStation.distanceKm) * config.ratePerKm).toFixed(2)
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromStation || !toStation) return;
    onRouteSelected(fromStation, toStation, parseFloat(previewFare!));
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <span>Loading stations…</span>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">⚠ {error}</div>;
  }

  return (
    <div className="card animate-in">
      <div className="card-title">
        <div className="card-title-icon">🗺</div>
        Select Your Journey
      </div>

      <form onSubmit={handleSubmit}>
        <div className="route-selector">
          {/* Origin */}
          <div className="form-group">
            <label className="form-label" htmlFor="from-station">From</label>
            <div className="select-wrapper">
              <select
                id="from-station"
                className="form-select"
                value={fromId}
                onChange={(e) => { setFromId(e.target.value); setToId(''); }}
                required
              >
                <option value="">Select origin…</option>
                {stations.slice(0, -1).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Arrow */}
          <div className="route-arrow" aria-hidden="true">→</div>

          {/* Destination */}
          <div className="form-group">
            <label className="form-label" htmlFor="to-station">To</label>
            <div className="select-wrapper">
              <select
                id="to-station"
                className="form-select"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                disabled={!fromId}
                required
              >
                <option value="">Select destination…</option>
                {destinationOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Fare preview */}
        {previewFare && (
          <div className="fare-preview mt-4">
            <div>
              <div className="fare-label">Estimated fare (reserved coach)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                {(toStation!.distanceKm - fromStation!.distanceKm).toFixed(0)} km ×
                LKR {config.ratePerKm}/km
              </div>
            </div>
            <div className="fare-amount">LKR {previewFare}</div>
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            id="search-seats-btn"
            className="btn btn-primary btn-lg w-full"
            disabled={!fromId || !toId}
          >
            Search Available Seats →
          </button>
        </div>
      </form>

      {/* Context note */}
      <p className="text-muted mt-4" style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
        💡 Only pay for the leg you travel. A seat from Colombo Fort → Kandy can be
        re-booked by another passenger from Kandy → Badulla.
      </p>
    </div>
  );
};

export default RouteSelect;
