import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ITimeProvider } from '#/application/time-provider.interface.js'
import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import { ExampleConcurrencyError } from '#/domain/example/error/example-concurrency.error.js'
import { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import { Example } from '#/domain/example/example.js'
import { IExampleRepository } from '#/domain/example/example.repository.interface.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import { ExampleKindReferenceNotFoundError } from '#/domain/example/kind/error/example-kind-reference-not-found.error.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'

import { toConcurrencyToken } from '../concurrency-token.codec.js'
import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
import { isRestrictViolation } from '../error/is-restrict-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { exampleDeleteRow, exampleRow, exampleUpdateRow } from './sql/examples.row.js'
import { QUERY } from './sql/queries.js'

const { DELETE, GET_ALL, GET, INSERT, UPDATE } = QUERY

@Injectable()
export class ExampleRepository implements IExampleRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>
  private readonly timeProvider: ITimeProvider

  public constructor(
    txHost: TransactionHost<TransactionalAdapterPgPromise>,
    timeProvider: ITimeProvider,
  ) {
    this.txHost = txHost
    this.timeProvider = timeProvider
  }

  public get(id: ExampleID): ResultAsync<WithConcurrencyToken<Example>, ExampleNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row => {
      if (row === null) {
        return errAsync(new ExampleNotFoundError(id))
      }

      const parsed = exampleRow.parse(row)

      return okAsync({ value: parsed.toDomain(), token: parsed.getConcurrencyToken() })
    })
  }

  public getAll(): ResultAsync<Example[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => exampleRow.parse(row).toDomain()))
  }

  public create(
    example: Example,
  ): ResultAsync<
    WithConcurrencyToken<Example>,
    DuplicateExampleIdError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  > {
    const { id, name, exampleKindId, url } = example
    const lastUpdated = this.timeProvider.now().toDate()

    return ResultAsync.fromPromise(
      this.txHost.tx.one<unknown>(INSERT, { id, name, exampleKindId, url, lastUpdated }),
      error => {
        if (isUniqueConstraintViolation('examples_pkey', error)) {
          return new DuplicateExampleIdError(id)
        }
        if (isUniqueConstraintViolation('examples_name', error)) {
          return new DuplicateExampleNameError(name)
        }
        if (isForeignKeyViolation('examples_example_kind_id_fkey', error)) {
          return new ExampleKindReferenceNotFoundError(exampleKindId)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).map(row => {
      const parsed = exampleRow.parse(row)

      return { value: parsed.toDomain(), token: parsed.getConcurrencyToken() }
    })
  }

  public update(
    example: Example,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Example>,
    | ExampleNotFoundError
    | DuplicateExampleNameError
    | ExampleKindReferenceNotFoundError
    | ExampleConcurrencyError
  > {
    const { id, name, exampleKindId, url } = example
    const lastUpdated = this.timeProvider.now().toDate()
    const self = this

    async function update(): Promise<WithConcurrencyToken<Example>> {
      // oneOrNone yields: null (no such example), all-null columns (stale token), or a populated row (updated).
      const row = await self.txHost.tx.oneOrNone<unknown>(UPDATE, {
        id,
        name,
        exampleKindId,
        url,
        lastUpdated,
        expectedToken,
      })

      if (row === null) {
        throw new ExampleNotFoundError(id)
      }

      const parsed = exampleUpdateRow.parse(row)

      if (parsed.id === null) {
        throw new ExampleConcurrencyError(id)
      }

      return {
        value: new Example({
          id: parsed.id,
          name: parsed.name,
          exampleKindId: parsed.example_kind_id,
          url: parsed.url,
        }),
        token: toConcurrencyToken(parsed.last_updated),
      }
    }

    return ResultAsync.fromPromise(update(), error => {
      if (error instanceof ExampleNotFoundError || error instanceof ExampleConcurrencyError) {
        return error
      }
      if (isUniqueConstraintViolation('examples_name', error)) {
        return new DuplicateExampleNameError(name)
      }
      if (isForeignKeyViolation('examples_example_kind_id_fkey', error)) {
        return new ExampleKindReferenceNotFoundError(exampleKindId)
      }

      throw new UnexpectedPersistenceError(error as Error)
    })
  }

  public delete(
    id: ExampleID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<void, ExampleNotFoundError | ExampleInUseError | ExampleConcurrencyError> {
    // oneOrNone yields: null (no such example), { id: null } (stale token), or { id } (deleted).
    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(DELETE, { id, expectedToken }),
      error => {
        if (isRestrictViolation('examples_to_skills_example_fkey', error)) {
          return new ExampleInUseError(id)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row => {
      if (row === null) {
        return errAsync(new ExampleNotFoundError(id))
      }

      return exampleDeleteRow.parse(row).id === null
        ? errAsync(new ExampleConcurrencyError(id))
        : okAsync(undefined)
    })
  }
}
