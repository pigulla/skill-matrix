import { ERROR_CODES } from './error-codes.js'
import { isPostgresError } from './is-postgres-error.js'

export function isUniqueConstraintViolation(name: string, error: unknown): boolean {
  return (
    isPostgresError(error) &&
    error.code === ERROR_CODES.INTEGRITY_CONSTRAINT_VIOLATION.UNIQUE_VIOLATION &&
    error.constraint === name
  )
}
