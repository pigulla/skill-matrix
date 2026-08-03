import { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { copyMethodMetadata } from 'nestjs-cls'
import { ResultAsync } from 'neverthrow'

class RollbackSignal<E> extends Error {
  public readonly error: E

  public constructor(error: E) {
    super('RollbackSignal')

    this.error = error
  }
}

/**
 * Like `@Transactional()`, but for methods returning `ResultAsync<T, E>`: an
 * `Err(...)` triggers a real rollback (order-independent), instead of being a
 * resolved value that `@Transactional()` would happily commit.
 */
export function ResultTransactional(connectionName?: string): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    const original = descriptor.value as (...args: unknown[]) => ResultAsync<unknown, unknown>

    function wrapped(this: unknown, ...args: unknown[]): ResultAsync<unknown, unknown> {
      const txHost = TransactionHost.getInstance<TransactionalAdapterPgPromise>(connectionName)

      return ResultAsync.fromPromise(
        txHost.withTransaction(async () => {
          const result = await original.apply(this, args)

          if (result.isErr()) {
            throw new RollbackSignal(result.error)
          }

          return result.value
        }),
        error => {
          if (error instanceof RollbackSignal) {
            return error.error
          }

          throw error
        },
      )
    }

    descriptor.value = wrapped as typeof descriptor.value

    copyMethodMetadata(original, descriptor.value)
  }
}
