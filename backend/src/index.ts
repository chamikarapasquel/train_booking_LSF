import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { AppError } from './errors';

import stationsRouter from './routes/stations';
import coachesRouter  from './routes/coaches';
import seatsRouter    from './routes/seats';
import bookingsRouter from './routes/bookings';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/stations', stationsRouter);
app.use('/api/coaches',  coachesRouter);
app.use('/api/seats',    seatsRouter);
app.use('/api/bookings', bookingsRouter);

// Health check — useful for Docker Compose readiness probes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Must have 4 parameters for Express to recognise it as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code:    err.code ?? 'ERROR',
        message: err.message,
      },
    });
  }

  // Unexpected errors — log and return a generic 500
  console.error('[Unhandled error]', err);
  res.status(500).json({
    error: {
      code:    'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`🚂 Train Booking API running on http://localhost:${config.port}`);
  console.log(`   Fare rate: LKR ${config.ratePerKm}/km`);
  console.log(`   Environment: ${config.nodeEnv}`);
});

export default app;
