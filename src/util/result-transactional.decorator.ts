import { Logger } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { copyMethodMetadata } from 'nestjs-cls'
import { Result, ResultAsync } from 'neverthrow'

import { TransactionConflictError } from '#/application/error/transaction-conflict.error.js'
import { isTransientTransactionError } from '#/infrastructure/persistence/error/is-transient-transaction-error.js'

const logger = new Logger('ResultTransactional')

class RollbackSignal extends Error {
  public constructor(cause: Error) {
    super(RollbackSignal.name, { cause })
  }
}

export function ResultTransactional(connectionName?: string): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    const original = descriptor.value as (...args: unknown[]) => ResultAsync<unknown, unknown>

    function wrapped(this: unknown, ...args: unknown[]): ResultAsync<unknown, unknown> {
      const txHost = TransactionHost.getInstance<TransactionalAdapterPgPromise>(connectionName)

      return ResultAsync.fromPromise(
        txHost.withTransaction(async () => {
          const result = (await original.apply(this, args)) as Result<unknown, Error>

          if (result.isErr()) {
            throw new RollbackSignal(result.error)
          }

          return result.value
        }),
        error => {
          if (error instanceof RollbackSignal) {
            return error.cause
          }

          if (isTransientTransactionError(error)) {
            logger.warn(
              { error },
              'Rolling back after a transient transaction conflict; throwing TransactionConflictError',
            )

            throw new TransactionConflictError(error)
          }

          throw error
        },
      )
    }

    descriptor.value = wrapped as typeof descriptor.value

    copyMethodMetadata(original, descriptor.value)
  }
}
