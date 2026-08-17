import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ITimeProvider } from '#/application/time-provider.interface.js'
import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import { DuplicateExampleKindIdError } from '#/domain/example/kind/error/duplicate-example-kind-id.error.js'
import { DuplicateExampleKindNameError } from '#/domain/example/kind/error/duplicate-example-kind-name.error.js'
import { ExampleKindConcurrencyError } from '#/domain/example/kind/error/example-kind-concurrency.error.js'
import { ExampleKindInUseError } from '#/domain/example/kind/error/example-kind-in-use.error.js'
import { ExampleKindNotFoundError } from '#/domain/example/kind/error/example-kind-not-found.error.js'
import { ExampleKind } from '#/domain/example/kind/example-kind.js'
import { IExampleKindRepository } from '#/domain/example/kind/example-kind.repository.interface.js'
import type { ExampleKindID } from '#/domain/example/kind/example-kind-id.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'

import { toConcurrencyToken } from '../../concurrency-token.codec.js'
import { isForeignKeyViolation } from '../../error/is-foreign-key-violation.js'
import { isUniqueConstraintViolation } from '../../error/is-unique-constraint-violation.js'

import {
  exampleKindDeleteRow,
  exampleKindRow,
  exampleKindUpdateRow,
} from './sql/example-kinds.row.js'
import { QUERY } from './sql/queries.js'

const { DELETE, GET, GET_ALL, INSERT, UPDATE } = QUERY

@Injectable()
export class ExampleKindRepository implements IExampleKindRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>
  private readonly timeProvider: ITimeProvider

  public constructor(
    txHost: TransactionHost<TransactionalAdapterPgPromise>,
    timeProvider: ITimeProvider,
  ) {
    this.txHost = txHost
    this.timeProvider = timeProvider
  }

  public get(
    id: ExampleKindID,
  ): ResultAsync<WithConcurrencyToken<ExampleKind>, ExampleKindNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row => {
      if (row === null) {
        return errAsync(new ExampleKindNotFoundError(id))
      }

      const parsed = exampleKindRow.parse(row)

      return okAsync({ value: parsed.toDomain(), token: parsed.getConcurrencyToken() })
    })
  }

  public getAll(): ResultAsync<ExampleKind[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => exampleKindRow.parse(row).toDomain()))
  }

  public create(
    exampleKind: ExampleKind,
  ): ResultAsync<
    WithConcurrencyToken<ExampleKind>,
    DuplicateExampleKindIdError | DuplicateExampleKindNameError
  > {
    const { id, name } = exampleKind
    const lastUpdated = this.timeProvider.now().toDate()

    return ResultAsync.fromPromise(
      this.txHost.tx.one<unknown>(INSERT, { id, name, lastUpdated }),
      error => {
        if (isUniqueConstraintViolation('example_kinds_pkey', error)) {
          return new DuplicateExampleKindIdError(id)
        }
        if (isUniqueConstraintViolation('example_kinds_name', error)) {
          return new DuplicateExampleKindNameError(name)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).map(row => {
      const parsed = exampleKindRow.parse(row)

      return { value: parsed.toDomain(), token: parsed.getConcurrencyToken() }
    })
  }

  public update(
    exampleKind: ExampleKind,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<ExampleKind>,
    ExampleKindNotFoundError | DuplicateExampleKindNameError | ExampleKindConcurrencyError
  > {
    const { id, name } = exampleKind
    const lastUpdated = this.timeProvider.now().toDate()
    const self = this

    async function update(): Promise<WithConcurrencyToken<ExampleKind>> {
      // oneOrNone yields: null (no such example kind), all-null columns (stale token), or a populated row (updated).
      const row = await self.txHost.tx.oneOrNone<unknown>(UPDATE, {
        id,
        name,
        lastUpdated,
        expectedToken,
      })

      if (row === null) {
        throw new ExampleKindNotFoundError(id)
      }

      const parsed = exampleKindUpdateRow.parse(row)

      if (parsed.id === null) {
        throw new ExampleKindConcurrencyError(id)
      }

      return {
        value: new ExampleKind({ id: parsed.id, name: parsed.name }),
        token: toConcurrencyToken(parsed.last_updated),
      }
    }

    return ResultAsync.fromPromise(update(), error => {
      if (
        error instanceof ExampleKindNotFoundError ||
        error instanceof ExampleKindConcurrencyError
      ) {
        return error
      }
      if (isUniqueConstraintViolation('example_kinds_name', error)) {
        return new DuplicateExampleKindNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    })
  }

  public delete(
    id: ExampleKindID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    void,
    ExampleKindNotFoundError | ExampleKindInUseError | ExampleKindConcurrencyError
  > {
    // oneOrNone yields: null (no such example kind), { id: null } (stale token), or { id } (deleted).
    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(DELETE, { id, expectedToken }),
      error => {
        if (isForeignKeyViolation('examples_example_kind_id_fkey', error)) {
          return new ExampleKindInUseError(id)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row => {
      if (row === null) {
        return errAsync(new ExampleKindNotFoundError(id))
      }

      return exampleKindDeleteRow.parse(row).id === null
        ? errAsync(new ExampleKindConcurrencyError(id))
        : okAsync(undefined)
    })
  }
}
