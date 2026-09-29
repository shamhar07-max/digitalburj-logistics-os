import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}
export const badRequest = (m: string, details?: unknown) => new HttpError(400, m, 'bad_request', details);
export const unauthorized = (m = 'Authentication required') => new HttpError(401, m, 'unauthorized');
export const forbidden = (m = 'You do not have permission to do that') => new HttpError(403, m, 'forbidden');
export const notFound = (m = 'Not found') => new HttpError(404, m, 'not_found');
export const conflict = (m: string) => new HttpError(409, m, 'conflict');

/** Wrap async route handlers so rejections reach the error middleware (Express 4). */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function errorMiddleware(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: 'Validation failed', code: 'validation', details: err.flatten().fieldErrors },
    });
  }
  // Postgres errors
  if (err?.code === '23505') return res.status(409).json({ error: { message: 'Duplicate record', code: 'duplicate', details: err.detail } });
  if (err?.code === '23503') return res.status(409).json({ error: { message: 'Record is referenced by other data', code: 'fk_violation' } });
  if (err?.code === '22P02') return res.status(400).json({ error: { message: 'Invalid id or value format', code: 'bad_format' } });
  if (err?.code === '23514') return res.status(400).json({ error: { message: 'Value violates a constraint', code: 'check_violation', details: err.constraint } });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Payload too large' } });
  logger.error({ err, path: req.path }, 'unhandled error');
  res.status(500).json({ error: { message: 'Internal server error', code: 'internal' } });
}
