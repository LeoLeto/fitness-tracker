import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { analyticsRouter } from './routes/analytics';
import { entriesRouter } from './routes/entries';
import { exercisesRouter } from './routes/exercises';
import { exportRouter } from './routes/export';
import { profileRouter } from './routes/profile';
import { workoutsRouter } from './routes/workouts';
import { HttpError } from './utils/rangeQuery';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/profile', profileRouter);
  app.use('/api/entries', entriesRouter);
  app.use('/api/exercises', exercisesRouter);
  app.use('/api/workouts', workoutsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/export', exportRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // In production the server also serves the built client (single deployable
  // Node app). During development the Vite dev server proxies /api instead.
  const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback: let client-side routing handle any non-API GET.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Central error handler — no stack traces or env details in responses.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
