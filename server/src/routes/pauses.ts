import { Router } from 'express';
import { activePause } from '../analytics/pauses';
import { serializePause, TrackingPauseModel } from '../models/TrackingPause';
import { asyncHandler } from '../utils/asyncHandler';
import { isValidDateStr, todayStr } from '../utils/dates';

export const pausesRouter = Router();

const MAX_NOTE_LEN = 200;

export async function loadPauses() {
  const docs = await TrackingPauseModel.find().sort({ startDate: 1 }).lean();
  return docs.map((d) => serializePause(d));
}

function parseNote(body: unknown): string | 'invalid' {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (raw.note === undefined || raw.note === null) return '';
  if (typeof raw.note !== 'string') return 'invalid';
  const trimmed = raw.note.trim();
  return trimmed.length > MAX_NOTE_LEN ? 'invalid' : trimmed;
}

// GET /api/pauses — every pause, newest first, with the running one (if any).
pausesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const pauses = await loadPauses();
    res.json({
      active: activePause(pauses),
      pauses: [...pauses].sort((a, b) => (a.startDate > b.startDate ? -1 : 1)),
    });
  })
);

// POST /api/pauses — start a pause today. Optional { startDate } backdates it,
// for the trip you only remember to pause from the airport.
pausesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const pauses = await loadPauses();
    if (activePause(pauses)) {
      res.status(409).json({ error: 'Tracking is already paused' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const startDate = body.startDate === undefined ? todayStr() : body.startDate;
    if (!isValidDateStr(startDate)) {
      res.status(400).json({ error: 'startDate must be a valid ISO date (YYYY-MM-DD)' });
      return;
    }
    if (startDate > todayStr()) {
      res.status(400).json({ error: 'A pause cannot start in the future' });
      return;
    }
    const note = parseNote(req.body);
    if (note === 'invalid') {
      res.status(400).json({ error: `note must be text of at most ${MAX_NOTE_LEN} characters` });
      return;
    }

    const created = await TrackingPauseModel.create({ startDate, endDate: null, note });
    res.status(201).json(serializePause(created.toObject()));
  })
);

// POST /api/pauses/resume — end the running pause. Defaults to today; an
// explicit { endDate } covers resuming a day or two after getting back.
pausesRouter.post(
  '/resume',
  asyncHandler(async (req, res) => {
    const pauses = await loadPauses();
    const active = activePause(pauses);
    if (!active) {
      res.status(409).json({ error: 'Tracking is not paused' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const endDate = body.endDate === undefined ? todayStr() : body.endDate;
    if (!isValidDateStr(endDate)) {
      res.status(400).json({ error: 'endDate must be a valid ISO date (YYYY-MM-DD)' });
      return;
    }
    if (endDate < active.startDate) {
      res.status(400).json({ error: 'A pause cannot end before it started' });
      return;
    }
    if (endDate > todayStr()) {
      res.status(400).json({ error: 'A pause cannot end in the future' });
      return;
    }

    const updated = await TrackingPauseModel.findByIdAndUpdate(
      active.id,
      { $set: { endDate } },
      { new: true }
    ).lean();
    res.json(serializePause(updated ?? {}));
  })
);

// DELETE /api/pauses/:id — drop a pause entirely, for one started by mistake.
// The days it covered go straight back into the averages.
pausesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const deleted = await TrackingPauseModel.findByIdAndDelete(req.params.id).catch(() => null);
    if (!deleted) {
      res.status(404).json({ error: 'No such pause' });
      return;
    }
    res.status(204).end();
  })
);
