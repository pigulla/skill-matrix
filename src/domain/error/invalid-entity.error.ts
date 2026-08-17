import type { ZodError } from 'zod'

import { DomainError } from './domain.error.js'

export abstract class InvalidEntityError extends DomainError {
  protected constructor(entityName: string, cause: ZodError) {
    super(`Entity of type ${entityName} has failed validation`, cause)
  }
}
