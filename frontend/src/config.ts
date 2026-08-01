/// <reference types="vite/client" />
// Runtime config read from environment variables baked in at Vite build time.
// In dev mode (npm run dev), the Vite proxy handles /api → localhost:4000,
// so VITE_API_URL is not needed. It's only used in the Docker build where
// we bake the URL at build time.

export const config = {
  // LKR per km — must match the backend value for consistent fare previews
  ratePerKm: parseFloat(import.meta.env['VITE_RATE_PER_KM'] ?? '2.5'),
} as const;
