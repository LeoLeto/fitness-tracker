import { Request } from 'express';
import { isValidDateStr } from './dates';

export interface DateRange {
  from?: string;
  to?: string;
}

/**
 * Parses optional ?from=YYYY-MM-DD&to=YYYY-MM-DD query params.
 * Throws a 400-style error (caught by the error middleware) on invalid dates.
 */
export function parseRangeQuery(req: Request): DateRange {
  const range: DateRange = {};
  const { from, to } = req.query;
  if (from !== undefined) {
    if (!isValidDateStr(from)) throw new HttpError(400, 'from must be a valid ISO date (YYYY-MM-DD)');
    range.from = from;
  }
  if (to !== undefined) {
    if (!isValidDateStr(to)) throw new HttpError(400, 'to must be a valid ISO date (YYYY-MM-DD)');
    range.to = to;
  }
  return range;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Builds a mongoose filter for entries within an optional date range. */
export function rangeFilter(range: DateRange): Record<string, unknown> {
  const dateFilter: Record<string, string> = {};
  if (range.from) dateFilter.$gte = range.from;
  if (range.to) dateFilter.$lte = range.to;
  return Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};
}
