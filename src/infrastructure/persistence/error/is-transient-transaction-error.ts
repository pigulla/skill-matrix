import { DatabaseError } from 'pg-protocol'

import { ERROR_CODES } from './error-codes.js'

function isTransientDatabaseError(error: unknown): error is Error {
  return (
    error instanceof DatabaseError &&
    (error.code === ERROR_CODES.TRANSACTION_ROLLBACK.SERIALIZATION_FAILURE ||
      error.code === ERROR_CODES.TRANSACTION_ROLLBACK.DEADLOCK_DETECTED)
  )
}

/**
 * True for the two PostgreSQL errors that mean "this transaction did not commit because it conflicted with
 * another one, not because anything was wrong with it". Checks the error itself and, if that doesn't match,
 * exactly one level of `.cause`: a repository's own error mapper already wraps an unrecognized pg error in
 * `UnexpectedPersistenceError(cause)` before it reaches `ResultTransactional`, while a failure raised by
 * COMMIT itself never passes through a repository and arrives unwrapped. One level covers both; there is no
 * deeper wrapping to unwrap today.
 */
export function isTransientTransactionError(error: unknown): error is Error {
  return (
    isTransientDatabaseError(error) ||
    (error instanceof Error && isTransientDatabaseError(error.cause))
  )
}
