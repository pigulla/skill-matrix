import type { ZodError } from 'zod'

import { DomainError } from './domain.error.js'

export abstract class InvalidEntityError extends DomainError {
  protected constructor(message: string, cause: ZodError) {
    super(message, cause)
  }
}
