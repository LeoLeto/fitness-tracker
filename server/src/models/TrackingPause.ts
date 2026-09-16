import mongoose, { Schema } from 'mongoose';
import { TrackingPause as TrackingPauseType } from '../types';

/**
 * One document per pause period. Pauses are append-only history: resuming
 * stamps `endDate` rather than deleting the record, so the analytics can still
 * tell why a fortnight of the calorie log is empty long after the trip.
 *
 * At most one document may have `endDate: null` — that one is the pause
 * currently running. The constraint is enforced in the route, which refuses to
 * start a second pause while one is active.
 */
const trackingPauseSchema = new Schema<TrackingPauseType>(
  {
    startDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    endDate: {
      type: String,
      default: null,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    note: { type: String, default: '' },
  },
  { timestamps: true, collection: 'tracking_pauses' }
);

trackingPauseSchema.index({ startDate: 1 });

export const TrackingPauseModel = mongoose.model<TrackingPauseType>(
  'TrackingPause',
  trackingPauseSchema
);

/** Plain API representation — no Mongo internals (_id, __v, timestamps). */
export function serializePause(
  doc: Partial<TrackingPauseType> & { _id?: unknown }
): TrackingPauseType {
  return {
    id: String(doc._id),
    startDate: doc.startDate as string,
    endDate: doc.endDate ?? null,
    note: doc.note ?? '',
  };
}
