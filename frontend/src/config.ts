/// <reference types="vite/client" />

export const config = {
  // LKR per km — must match the backend value for consistent fare previews
  ratePerKm: parseFloat(import.meta.env['VITE_RATE_PER_KM'] ?? '2.5'),
} as const;
