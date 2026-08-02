import React from 'react';
import type { BookingStep } from '../types';

interface StepIndicatorProps {
  currentStep: BookingStep;
}

// WAITLIST_CONFIRMATION maps to the same visual index as CONFIRMATION
// but renders with amber "waitlist" styling instead of green "done"
const STEPS: { id: BookingStep; label: string }[] = [
  { id: 'SELECT_ROUTE',      label: 'Route'    },
  { id: 'SELECT_SEAT',       label: 'Seat'     },
  { id: 'PASSENGER_DETAILS', label: 'Details'  },
  { id: 'CONFIRMATION',      label: 'Confirmed' },
];

const isWaitlistStep = (s: BookingStep) => s === 'WAITLIST_CONFIRMATION';

// Map WAITLIST_CONFIRMATION to index 3 (same as CONFIRMATION) for positioning
const stepIndex = (s: BookingStep): number => {
  if (isWaitlistStep(s)) return 3;
  return STEPS.findIndex((st) => st.id === s);
};

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const current    = stepIndex(currentStep);
  const isWaitlist = isWaitlistStep(currentStep);

  return (
    <div className="steps" role="list" aria-label="Booking steps">
      {STEPS.map((step, idx) => {
        const isDone   = idx < current;
        const isActive = idx === current;
        // Last step uses amber "waitlisted" variant instead of green "done"
        const isWaitlistActive = isActive && isWaitlist;

        let cls = '';
        if (isWaitlistActive)    cls = 'waitlisted';
        else if (isActive)       cls = 'active';
        else if (isDone)         cls = 'done';

        const label = isWaitlistActive ? 'Waitlisted' : step.label;

        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div
                className={`step-connector ${idx <= current ? (isWaitlist && idx === current ? 'waitlisted' : 'done') : ''}`}
                aria-hidden="true"
              />
            )}
            <div className={`step ${cls}`} role="listitem" aria-current={isActive ? 'step' : undefined}>
              <div className="step-circle" aria-hidden="true">
                {isDone && !isWaitlistActive ? '✓' : isWaitlistActive ? '⏳' : idx + 1}
              </div>
              <span className="step-label">{label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepIndicator;
