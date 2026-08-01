import React, { useEffect, useState, useMemo } from 'react';
import { fetchSeatAvailability } from '../api/client';
import type { SeatAvailability, Station } from '../types';

interface SeatMapProps {
  fromStation: Station;
  toStation: Station;
  selectedSeatId: string | null;
  onSeatSelect: (seat: SeatAvailability) => void;
}

// ── Seat number parsing helpers ───────────────────────────────────────────────
// Seat numbers are in the format "1A", "12D", etc.
// We extract the row number and column letter to build the grid.
function parseSeat(seatNumber: string): { row: number; col: string } {
  const match = seatNumber.match(/^(\d+)([A-Z]+)$/);
  if (!match) return { row: 0, col: 'A' };
  return { row: parseInt(match[1], 10), col: match[2] };
}

const SeatMap: React.FC<SeatMapProps> = ({ fromStation, toStation, selectedSeatId, onSeatSelect }) => {
  const [seats,       setSeats]       = useState<SeatAvailability[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeCoach, setActiveCoach] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchSeatAvailability(fromStation.id, toStation.id)
      .then((data) => {
        setSeats(data);
        // Default to the first coach
        if (data.length > 0) {
          setActiveCoach(data[0].coachId);
        }
      })
      .catch(() => setError('Failed to load seat availability.'))
      .finally(() => setLoading(false));
  }, [fromStation.id, toStation.id]);

  // Group by coach
  const coaches = useMemo(() => {
    const map = new Map<string, { coachId: string; coachName: string; seats: SeatAvailability[] }>();
    for (const seat of seats) {
      if (!map.has(seat.coachId)) {
        map.set(seat.coachId, { coachId: seat.coachId, coachName: seat.coachName, seats: [] });
      }
      map.get(seat.coachId)!.seats.push(seat);
    }
    return Array.from(map.values());
  }, [seats]);

  // Build grid for the active coach
  const activeCoachData = coaches.find((c) => c.coachId === activeCoach);

  const grid = useMemo(() => {
    if (!activeCoachData) return [];
    // Group seats by row number
    const rowMap = new Map<number, SeatAvailability[]>();
    for (const seat of activeCoachData.seats) {
      const { row } = parseSeat(seat.seatNumber);
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row)!.push(seat);
    }
    // Sort rows
    return Array.from(rowMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([row, rowSeats]) => ({
        row,
        // Sort seats by column letter
        seats: rowSeats.sort((a, b) => {
          const aCol = parseSeat(a.seatNumber).col;
          const bCol = parseSeat(b.seatNumber).col;
          return aCol.localeCompare(bCol);
        }),
      }));
  }, [activeCoachData]);

  // Stats
  const availableCount = activeCoachData?.seats.filter((s) => s.available).length ?? 0;
  const totalCount     = activeCoachData?.seats.length ?? 0;

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <span>Loading seat availability…</span>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">⚠ {error}</div>;
  }

  if (seats.length === 0) {
    return <div className="alert alert-info">No reserved seats found in the system.</div>;
  }

  return (
    <div className="card animate-in">
      <div className="card-title">
        <div className="card-title-icon">💺</div>
        Select a Seat
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
          {fromStation.name} → {toStation.name}
        </span>
      </div>

      {/* Coach tabs */}
      <div className="coach-tabs" role="tablist" aria-label="Coach selection">
        {coaches.map((coach) => {
          const avail = coach.seats.filter((s) => s.available).length;
          return (
            <button
              key={coach.coachId}
              id={`coach-tab-${coach.coachName}`}
              role="tab"
              aria-selected={coach.coachId === activeCoach}
              className={`coach-tab ${coach.coachId === activeCoach ? 'active' : ''}`}
              onClick={() => setActiveCoach(coach.coachId)}
            >
              Coach {coach.coachName}
              <span style={{
                marginLeft: 6,
                fontSize: '0.72rem',
                color: avail > 0 ? 'var(--color-success)' : 'var(--color-text-dim)',
              }}>
                {avail} free
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="seat-map-legend">
        <div className="legend-item">
          <div className="legend-dot available" />
          Available ({availableCount})
        </div>
        <div className="legend-item">
          <div className="legend-dot occupied" />
          Occupied ({totalCount - availableCount})
        </div>
        <div className="legend-item">
          <div className="legend-dot selected" />
          Your selection
        </div>
      </div>

      {/* Seat grid */}
      <div className="seat-grid-container">
        {/* Column header */}
        <div className="seat-grid" aria-label="Seat map">
          {/* Header row */}
          <div className="seat-row" style={{ marginBottom: 4 }}>
            <div />
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>A</div>
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>B</div>
            <div style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>│</div>
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>C</div>
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>D</div>
          </div>

          {grid.map(({ row, seats: rowSeats }) => {
            // We expect seats A, B, C, D. Create a lookup.
            const seatByCol: Record<string, SeatAvailability | undefined> = {};
            for (const s of rowSeats) {
              seatByCol[parseSeat(s.seatNumber).col] = s;
            }

            return (
              <div key={row} className="seat-row">
                <div className="seat-row-num">{row}</div>
                {['A', 'B'].map((col) => {
                  const seat = seatByCol[col];
                  if (!seat) return <div key={col} />;
                  const isSelected = seat.seatId === selectedSeatId;
                  const cls = isSelected ? 'selected' : seat.available ? 'available' : 'occupied';
                  return (
                    <button
                      key={col}
                      id={`seat-${seat.coachName}-${seat.seatNumber}`}
                      className={`seat-btn ${cls}`}
                      onClick={() => seat.available && onSeatSelect(seat)}
                      disabled={!seat.available}
                      title={`${seat.coachName} ${seat.seatNumber} — ${seat.available ? 'Available' : 'Occupied'}`}
                      aria-label={`Seat ${seat.seatNumber}, ${seat.available ? 'available' : 'occupied'}`}
                      aria-pressed={isSelected}
                    >
                      {seat.seatNumber}
                    </button>
                  );
                })}
                {/* Aisle */}
                <div className="seat-aisle" />
                {['C', 'D'].map((col) => {
                  const seat = seatByCol[col];
                  if (!seat) return <div key={col} />;
                  const isSelected = seat.seatId === selectedSeatId;
                  const cls = isSelected ? 'selected' : seat.available ? 'available' : 'occupied';
                  return (
                    <button
                      key={col}
                      id={`seat-${seat.coachName}-${seat.seatNumber}`}
                      className={`seat-btn ${cls}`}
                      onClick={() => seat.available && onSeatSelect(seat)}
                      disabled={!seat.available}
                      title={`${seat.coachName} ${seat.seatNumber} — ${seat.available ? 'Available' : 'Occupied'}`}
                      aria-label={`Seat ${seat.seatNumber}, ${seat.available ? 'available' : 'occupied'}`}
                      aria-pressed={isSelected}
                    >
                      {seat.seatNumber}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {availableCount === 0 && (
        <div className="alert alert-error mt-6">
          No available seats on this coach for the selected leg.
          Try a different coach or a different route.
        </div>
      )}
    </div>
  );
};

export default SeatMap;
