import React, { useEffect, useState, useMemo, useRef } from 'react';
import { fetchSeatAvailability } from '../api/client';
import type { SeatAvailability, Station } from '../types';

interface SeatMapProps {
  fromStation: Station;
  toStation: Station;
  selectedSeatId: string | null;
  onSeatSelect: (seat: SeatAvailability) => void;
}

// ── Seat number parsing helpers ───────────────────────────────────────────────
function parseSeat(seatNumber: string): { row: number; col: string } {
  const match = seatNumber.match(/^(\d+)([A-Z]+)$/);
  if (!match) return { row: 0, col: 'A' };
  return { row: parseInt(match[1], 10), col: match[2] };
}

// ── Tooltip Component ─────────────────────────────────────────────────────────
interface TooltipState {
  seat: SeatAvailability;
  x: number;
  y: number;
}

const SeatTooltip: React.FC<{ tooltip: TooltipState }> = ({ tooltip }) => (
  <div
    className="seat-tooltip"
    style={{ left: tooltip.x, top: tooltip.y }}
    role="tooltip"
  >
    <div className="seat-tooltip-number">{tooltip.seat.coachName} · {tooltip.seat.seatNumber}</div>
    <div className={`seat-tooltip-status ${tooltip.seat.available ? 'available' : 'occupied'}`}>
      {tooltip.seat.available ? '✓ Available' : '✗ Occupied'}
    </div>
  </div>
);

// ── Coach Train Diagram ────────────────────────────────────────────────────────
const CoachDiagram: React.FC<{
  coaches: { coachId: string; coachName: string; seats: SeatAvailability[] }[];
  activeCoach: string;
  onSelect: (id: string) => void;
}> = ({ coaches, activeCoach, onSelect }) => (
  <div className="train-diagram" aria-label="Select coach">
    <div className="train-diagram-label">🚂 Locomotive</div>
    <div className="train-coaches-row">
      {coaches.map((coach, i) => {
        const avail = coach.seats.filter((s) => s.available).length;
        const total = coach.seats.length;
        const pct   = total > 0 ? Math.round((avail / total) * 100) : 0;
        const isActive = coach.coachId === activeCoach;
        return (
          <button
            key={coach.coachId}
            id={`coach-diagram-${coach.coachName}`}
            className={`train-coach-block ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(coach.coachId)}
            aria-selected={isActive}
            title={`Coach ${coach.coachName} — ${avail}/${total} free`}
          >
            {/* Coach windows */}
            <div className="coach-block-windows">
              {Array.from({ length: 4 }).map((_, w) => (
                <div key={w} className="coach-window" />
              ))}
            </div>
            <div className="coach-block-name">Coach {coach.coachName}</div>
            <div className="coach-block-bar">
              <div
                className="coach-block-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="coach-block-stats">{avail} free</div>
            {/* Connector between coaches */}
            {i < coaches.length - 1 && <div className="coach-connector" />}
          </button>
        );
      })}
    </div>
    <div className="train-diagram-label">Guard Van 🚃</div>
  </div>
);

// ── Individual Seat Button ────────────────────────────────────────────────────
const SeatButton: React.FC<{
  seat: SeatAvailability;
  isSelected: boolean;
  onSelect: (seat: SeatAvailability) => void;
  onHover: (seat: SeatAvailability | null, e?: React.MouseEvent) => void;
}> = ({ seat, isSelected, onSelect, onHover }) => {
  const cls = isSelected ? 'selected' : seat.available ? 'available' : 'occupied';

  return (
    <button
      id={`seat-${seat.coachName}-${seat.seatNumber}`}
      className={`seat-btn-v2 ${cls}`}
      onClick={() => seat.available && onSelect(seat)}
      onMouseEnter={(e) => onHover(seat, e)}
      onMouseLeave={() => onHover(null)}
      disabled={!seat.available}
      aria-label={`Seat ${seat.seatNumber}, ${seat.available ? 'available' : 'occupied'}`}
      aria-pressed={isSelected}
    >
      {/* Seat back headrest */}
      <div className="seat-headrest" />
      {/* Seat body */}
      <div className="seat-body">
        <span className="seat-label">{seat.seatNumber}</span>
      </div>
      {/* Selected checkmark */}
      {isSelected && <div className="seat-check">✓</div>}
    </button>
  );
};

// ── Main SeatMap Component ────────────────────────────────────────────────────
const SeatMap: React.FC<SeatMapProps> = ({ fromStation, toStation, selectedSeatId, onSeatSelect }) => {
  const [seats,       setSeats]       = useState<SeatAvailability[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeCoach, setActiveCoach] = useState<string>('');
  const [tooltip,     setTooltip]     = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    // Initial load
    setLoading(true);
    fetchSeatAvailability(fromStation.id, toStation.id)
      .then((data) => {
        if (!mounted) return;
        setSeats(data);
        if (data.length > 0) setActiveCoach(data[0].coachId);
      })
      .catch(() => { if (mounted) setError('Failed to load seat availability.'); })
      .finally(() => { if (mounted) setLoading(false); });

    // Poll every 5 seconds
    const intervalId = setInterval(() => {
      fetchSeatAvailability(fromStation.id, toStation.id)
        .then((data) => {
          if (mounted) setSeats(data);
        })
        .catch(() => { /* silently fail background polls */ });
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
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

  const activeCoachData = coaches.find((c) => c.coachId === activeCoach);

  // Build row grid for the active coach
  const grid = useMemo(() => {
    if (!activeCoachData) return [];
    const rowMap = new Map<number, SeatAvailability[]>();
    for (const seat of activeCoachData.seats) {
      const { row } = parseSeat(seat.seatNumber);
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row)!.push(seat);
    }
    return Array.from(rowMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([row, rowSeats]) => ({
        row,
        seats: rowSeats.sort((a, b) => parseSeat(a.seatNumber).col.localeCompare(parseSeat(b.seatNumber).col)),
      }));
  }, [activeCoachData]);

  const availableCount = activeCoachData?.seats.filter((s) => s.available).length ?? 0;
  const totalCount     = activeCoachData?.seats.length ?? 0;
  const occupancyPct   = totalCount > 0 ? Math.round(((totalCount - availableCount) / totalCount) * 100) : 0;

  const handleHover = (seat: SeatAvailability | null, e?: React.MouseEvent) => {
    if (!seat || !e || !containerRef.current) {
      setTooltip(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({ seat, x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 48 });
  };

  // ── Loading state ──────────────────────────────────────────────────────────
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
    <div className="seatmap-card animate-in" ref={containerRef}>
      {/* ── Header ── */}
      <div className="seatmap-header">
        <div className="seatmap-header-left">
          <div className="seatmap-icon">💺</div>
          <div>
            <div className="seatmap-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Select Your Seat
              <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--color-success)', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
                Live Updates
              </span>
            </div>
            <div className="seatmap-route">
              {fromStation.name} <span className="seatmap-route-arrow">→</span> {toStation.name}
            </div>
          </div>
        </div>
        <div className="seatmap-header-right">
          <div className="occupancy-ring-wrap" title={`${occupancyPct}% occupied`}>
            <svg viewBox="0 0 40 40" className="occupancy-ring">
              <circle cx="20" cy="20" r="16" />
              <circle
                cx="20" cy="20" r="16"
                className="occupancy-ring-fill"
                strokeDasharray={`${occupancyPct} 100`}
              />
            </svg>
            <span className="occupancy-ring-label">{occupancyPct}%</span>
          </div>
          <div>
            <div className="occupancy-text">{availableCount} seats free</div>
            <div className="occupancy-sub">of {totalCount} in coach</div>
          </div>
        </div>
      </div>

      {/* ── Train Diagram / Coach Selector ── */}
      <CoachDiagram coaches={coaches} activeCoach={activeCoach} onSelect={setActiveCoach} />

      {/* ── Legend ── */}
      <div className="seatmap-legend">
        <div className="legend-pill available">
          <span className="legend-seat-icon" />
          <span>Available ({availableCount})</span>
        </div>
        <div className="legend-pill occupied">
          <span className="legend-seat-icon" />
          <span>Occupied ({totalCount - availableCount})</span>
        </div>
        <div className="legend-pill selected">
          <span className="legend-seat-icon" />
          <span>Your Seat</span>
        </div>
      </div>

      {/* ── Carriage Visualization ── */}
      <div className="carriage-wrap">
        {/* Carriage shell */}
        <div className="carriage">
          {/* Front of carriage */}
          <div className="carriage-end carriage-front">
            <div className="carriage-end-label">FRONT</div>
            <div className="carriage-door" />
          </div>

          {/* Carriage interior */}
          <div className="carriage-interior">
            {/* Column headers */}
            <div className="carriage-col-headers">
              <div className="col-header">A</div>
              <div className="col-header">B</div>
              <div className="col-header aisle-header">AISLE</div>
              <div className="col-header">C</div>
              <div className="col-header">D</div>
            </div>

            {/* Seat rows */}
            <div className="carriage-seats" key={activeCoach}>
              {grid.map(({ row, seats: rowSeats }) => {
                const byCol: Record<string, SeatAvailability | undefined> = {};
                rowSeats.forEach((s) => { byCol[parseSeat(s.seatNumber).col] = s; });

                return (
                  <div key={row} className="carriage-row">
                    {/* Left window */}
                    <div className="carriage-window" />

                    {/* Row number */}
                    <div className="carriage-row-num">{row}</div>

                    {/* Seats A & B */}
                    <div className="seat-pair">
                      {['A', 'B'].map((col) => {
                        const seat = byCol[col];
                        if (!seat) return <div key={col} className="seat-placeholder" />;
                        return (
                          <SeatButton
                            key={col}
                            seat={seat}
                            isSelected={seat.seatId === selectedSeatId}
                            onSelect={onSeatSelect}
                            onHover={handleHover}
                          />
                        );
                      })}
                    </div>

                    {/* Aisle */}
                    <div className="carriage-aisle">
                      <div className="aisle-line" />
                    </div>

                    {/* Seats C & D */}
                    <div className="seat-pair">
                      {['C', 'D'].map((col) => {
                        const seat = byCol[col];
                        if (!seat) return <div key={col} className="seat-placeholder" />;
                        return (
                          <SeatButton
                            key={col}
                            seat={seat}
                            isSelected={seat.seatId === selectedSeatId}
                            onSelect={onSeatSelect}
                            onHover={handleHover}
                          />
                        );
                      })}
                    </div>

                    {/* Row number (right side) */}
                    <div className="carriage-row-num">{row}</div>

                    {/* Right window */}
                    <div className="carriage-window" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rear of carriage */}
          <div className="carriage-end carriage-rear">
            <div className="carriage-door" />
            <div className="carriage-end-label">REAR</div>
          </div>
        </div>
      </div>

      {/* No seats warning */}
      {availableCount === 0 && (
        <div className="alert alert-error mt-6">
          No available seats in this coach for the selected leg.
          Try switching to another coach above.
        </div>
      )}

      {/* Tooltip */}
      {tooltip && <SeatTooltip tooltip={tooltip} />}
    </div>
  );
};

export default SeatMap;
