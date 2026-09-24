import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { serializeError } from 'serialize-error'

import { TransactionConflictError } from '#/application/error/transaction-conflict.error.js'
import { DuplicateEntityError } from '#/domain/error/duplicate-entity.error.js'
import { EntityConcurrencyError } from '#/domain/error/entity-concurrency.error.js'
import { EntityInUseError } from '#/domain/error/entity-in-use.error.js'
import { EntityNotFoundError } from '#/domain/error/entity-not-found.error.js'
import { EntityReferenceNotFoundError } from '#/domain/error/entity-reference-not-found.error.js'

@Catch()
export class DomainErrorsExceptionFilter extends BaseExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const cause = serializeError(exception)

    if (exception instanceof EntityNotFoundError) {
      super.catch(new NotFoundException(exception.message, { cause }), host)
    } else if (exception instanceof EntityInUseError) {
      super.catch(new ConflictException(exception.message, { cause }), host)
    } else if (exception instanceof DuplicateEntityError) {
      super.catch(new ConflictException(exception.message, { cause }), host)
    } else if (exception instanceof TransactionConflictError) {
      super.catch(new ConflictException(exception.message, { cause }), host)
    } else if (exception instanceof EntityReferenceNotFoundError) {
      super.catch(new UnprocessableEntityException(exception.message, { cause }), host)
    } else if (exception instanceof EntityConcurrencyError) {
      super.catch(new PreconditionFailedException(exception.message, { cause }), host)
    } else {
      super.catch(exception, host)
    }
  }
}
