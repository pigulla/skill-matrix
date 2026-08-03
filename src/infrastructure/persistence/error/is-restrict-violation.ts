import { DatabaseError } from 'pg-protocol'

import { ERROR_CODES } from './error-codes.js'

export function isRestrictViolation(name: string, error: unknown): boolean {
  return (
    error instanceof DatabaseError &&
    error.code === ERROR_CODES.INTEGRITY_CONSTRAINT_VIOLATION.RESTRICT_VIOLATION &&
    error.constraint === name
  )
}
