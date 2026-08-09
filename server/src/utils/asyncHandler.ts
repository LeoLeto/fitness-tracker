import { NextFunction, Request, RequestHandler, Response } from 'express';

/** Routes async errors to the Express error middleware (Express 4 doesn't do this natively). */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
