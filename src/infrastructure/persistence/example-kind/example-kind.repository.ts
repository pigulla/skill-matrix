import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { DuplicateExampleKindError } from '#/domain/example-kind/error/duplicate-example-kind.error.js'
import { ExampleKindInUseError } from '#/domain/example-kind/error/example-kind-in-use.error.js'
import { ExampleKindNotFoundError } from '#/domain/example-kind/error/example-kind-not-found.error.js'
import type { ExampleKind } from '#/domain/example-kind/example-kind.js'
import { IExampleKindRepository } from '#/domain/example-kind/example-kind.repository.interface.js'

import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { exampleKindRow } from './sql/example-kinds.row.js'
import { QUERY } from './sql/queries.js'

const { DELETE, GET, GET_ALL, INSERT } = QUERY

@Injectable()
export class ExampleKindRepository implements IExampleKindRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>

  public constructor(txHost: TransactionHost<TransactionalAdapterPgPromise>) {
    this.txHost = txHost
  }

  public get(kind: ExampleKind): ResultAsync<ExampleKind, ExampleKindNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET, { kind }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row =>
      row === null
        ? errAsync(new ExampleKindNotFoundError(kind))
        : okAsync(exampleKindRow.parse(row).toDomain()),
    )
  }

  public getAll(): ResultAsync<ExampleKind[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => exampleKindRow.parse(row).toDomain()))
  }

  public create(kind: ExampleKind): ResultAsync<ExampleKind, DuplicateExampleKindError> {
    return ResultAsync.fromPromise(this.txHost.tx.one<unknown>(INSERT, { kind }), error => {
      if (isUniqueConstraintViolation('example_kinds_pkey', error)) {
        return new DuplicateExampleKindError(kind)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }).map(row => exampleKindRow.parse(row).toDomain())
  }

  public delete(
    kind: ExampleKind,
  ): ResultAsync<void, ExampleKindNotFoundError | ExampleKindInUseError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(DELETE, { kind }), error => {
      if (isForeignKeyViolation('examples_kind_fkey', error)) {
        return new ExampleKindInUseError(kind)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row =>
      row === null ? errAsync(new ExampleKindNotFoundError(kind)) : okAsync(undefined),
    )
  }
}
