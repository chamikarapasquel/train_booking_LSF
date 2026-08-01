import React from 'react';
import type { BookingStep } from '../types';

interface StepIndicatorProps {
  currentStep: BookingStep;
}

const STEPS: { id: BookingStep; label: string }[] = [
  { id: 'SELECT_ROUTE',      label: 'Route' },
  { id: 'SELECT_SEAT',       label: 'Seat' },
  { id: 'PASSENGER_DETAILS', label: 'Details' },
  { id: 'CONFIRMATION',      label: 'Confirmed' },
];

const stepIndex = (s: BookingStep) => STEPS.findIndex((st) => st.id === s);

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const current = stepIndex(currentStep);

  return (
    <div className="steps" role="list" aria-label="Booking steps">
      {STEPS.map((step, idx) => {
        const isDone   = idx < current;
        const isActive = idx === current;
        const cls = isDone ? 'done' : isActive ? 'active' : '';

        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div className={`step-connector ${idx <= current ? 'done' : ''}`} aria-hidden="true" />
            )}
            <div className={`step ${cls}`} role="listitem" aria-current={isActive ? 'step' : undefined}>
              <div className="step-circle" aria-hidden="true">
                {isDone ? '✓' : idx + 1}
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepIndicator;
