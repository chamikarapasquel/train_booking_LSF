//config.ts — reads and validates environment variables at startup.

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '4000', 10),

  // RATE_PER_KM: LKR per kilometre for reserved coach seats.
  // Changing this in .env immediately adjusts all future fare calculations.
  ratePerKm: parseFloat(process.env['RATE_PER_KM'] ?? '2.5'),

  nodeEnv: process.env['NODE_ENV'] ?? 'development',
} as const;
