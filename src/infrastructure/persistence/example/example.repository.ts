import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import type { Example } from '#/domain/example/example.js'
import { IExampleRepository } from '#/domain/example/example.repository.interface.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import { ExampleKindReferenceNotFoundError } from '#/domain/example-kind/error/example-kind-reference-not-found.error.js'

import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
import { isRestrictViolation } from '../error/is-restrict-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { exampleRow } from './sql/examples.row.js'
import { QUERY } from './sql/queries.js'

const { DELETE, GET_ALL, GET, GET_MANY, INSERT, UPDATE } = QUERY

@Injectable()
export class ExampleRepository implements IExampleRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>

  public constructor(txHost: TransactionHost<TransactionalAdapterPgPromise>) {
    this.txHost = txHost
  }

  public get(id: ExampleID): ResultAsync<Example, ExampleNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row =>
      row === null
        ? errAsync(new ExampleNotFoundError(id))
        : okAsync(exampleRow.parse(row).toDomain()),
    )
  }

  public getAll(): ResultAsync<Example[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => exampleRow.parse(row).toDomain()))
  }

  public getMany(ids: ReadonlySet<ExampleID>): ResultAsync<Example[], ExampleNotFoundError> {
    if (ids.size === 0) {
      return okAsync([])
    }

    return ResultAsync.fromPromise(
      this.txHost.tx.manyOrNone<unknown>(GET_MANY, { ids: [...ids] }),
      error => {
        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(rows => {
      const foundExamples = rows.map(row => exampleRow.parse(row).toDomain())
      const found = new Set(foundExamples.map(example => example.id))
      const missing = ids.difference(found)

      return missing.size > 0
        ? errAsync(new ExampleNotFoundError([...missing][0]))
        : okAsync(foundExamples)
    })
  }

  public create(
    example: Example,
  ): ResultAsync<
    Example,
    DuplicateExampleIdError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  > {
    const { id, name, kind, url } = example

    return ResultAsync.fromPromise(
      this.txHost.tx.one<unknown>(INSERT, { id, name, kind, url }),
      error => {
        if (isUniqueConstraintViolation('examples_pkey', error)) {
          return new DuplicateExampleIdError(id)
        }
        if (isUniqueConstraintViolation('examples_name', error)) {
          return new DuplicateExampleNameError(name)
        }
        if (isForeignKeyViolation('examples_kind_fkey', error)) {
          return new ExampleKindReferenceNotFoundError(kind)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).map(row => exampleRow.parse(row).toDomain())
  }

  public update(
    example: Example,
  ): ResultAsync<
    Example,
    ExampleNotFoundError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  > {
    const { id, name, kind, url } = example

    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(UPDATE, { id, name, kind, url }),
      error => {
        if (isUniqueConstraintViolation('examples_name', error)) {
          return new DuplicateExampleNameError(name)
        }
        if (isForeignKeyViolation('examples_kind_fkey', error)) {
          return new ExampleKindReferenceNotFoundError(kind)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row =>
      row === null
        ? errAsync(new ExampleNotFoundError(id))
        : okAsync(exampleRow.parse(row).toDomain()),
    )
  }

  public delete(id: ExampleID): ResultAsync<void, ExampleNotFoundError | ExampleInUseError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(DELETE, { id }), error => {
      if (isRestrictViolation('examples_to_skills_example_fkey', error)) {
        return new ExampleInUseError(id)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row => (row === null ? errAsync(new ExampleNotFoundError(id)) : okAsync(undefined)))
  }
}
