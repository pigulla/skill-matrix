import { ERROR_CODES } from './error-codes.js'
import { isPostgresError } from './is-postgres-error.js'

export function isForeignKeyViolation(name: string, error: unknown): boolean {
  return (
    isPostgresError(error) &&
    error.code === ERROR_CODES.INTEGRITY_CONSTRAINT_VIOLATION.FOREIGN_KEY_VIOLATION &&
    error.constraint === name
  )
}
