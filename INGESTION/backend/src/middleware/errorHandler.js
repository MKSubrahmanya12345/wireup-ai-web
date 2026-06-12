import { ZodError } from 'zod'
import { HttpError } from '../utils/httpError.js'

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      error: { message: 'Invalid request', issues: err.issues },
    })
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ ok: false, error: { message: err.message, details: err.details } })
  }

  const status = err?.status && Number.isInteger(err.status) ? err.status : 500
  res.status(status).json({ ok: false, error: { message: err?.message ?? 'Internal Server Error' } })
}

