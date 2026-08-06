import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { DuplicateExampleKindIdError } from '#/domain/example/kind/error/duplicate-example-kind-id.error.js'
import { DuplicateExampleKindNameError } from '#/domain/example/kind/error/duplicate-example-kind-name.error.js'
import { ExampleKindInUseError } from '#/domain/example/kind/error/example-kind-in-use.error.js'
import { ExampleKindNotFoundError } from '#/domain/example/kind/error/example-kind-not-found.error.js'
import type { ExampleKind } from '#/domain/example/kind/example-kind.js'
import { IExampleKindRepository } from '#/domain/example/kind/example-kind.repository.interface.js'
import type { ExampleKindID } from '#/domain/example/kind/example-kind-id.js'

import { isForeignKeyViolation } from '../../error/is-foreign-key-violation.js'
import { isUniqueConstraintViolation } from '../../error/is-unique-constraint-violation.js'

import { exampleKindsRow } from './sql/example-kinds.row.js'
import { QUERY } from './sql/queries.js'

const { DELETE, GET, GET_ALL, INSERT, UPDATE } = QUERY

@Injectable()
export class ExampleKindRepository implements IExampleKindRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>

  public constructor(txHost: TransactionHost<TransactionalAdapterPgPromise>) {
    this.txHost = txHost
  }

  public get(id: ExampleKindID): ResultAsync<ExampleKind, ExampleKindNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row =>
      row === null
        ? errAsync(new ExampleKindNotFoundError(id))
        : okAsync(exampleKindsRow.parse(row).toDomain()),
    )
  }

  public getAll(): ResultAsync<ExampleKind[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => exampleKindsRow.parse(row).toDomain()))
  }

  public create({
    id,
    name,
  }: ExampleKind): ResultAsync<
    ExampleKind,
    DuplicateExampleKindIdError | DuplicateExampleKindNameError
  > {
    return ResultAsync.fromPromise(this.txHost.tx.one<unknown>(INSERT, { id, name }), error => {
      if (isUniqueConstraintViolation('example_kinds_pkey', error)) {
        return new DuplicateExampleKindIdError(id)
      }
      if (isUniqueConstraintViolation('example_kinds_name', error)) {
        return new DuplicateExampleKindNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }).map(row => exampleKindsRow.parse(row).toDomain())
  }

  public update({
    id,
    name,
  }: ExampleKind): ResultAsync<
    ExampleKind,
    ExampleKindNotFoundError | DuplicateExampleKindNameError
  > {
    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(UPDATE, { id, name }),
      error => {
        if (isUniqueConstraintViolation('example_kinds_name', error)) {
          return new DuplicateExampleKindNameError(name)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row =>
      row === null
        ? errAsync(new ExampleKindNotFoundError(id))
        : okAsync(exampleKindsRow.parse(row).toDomain()),
    )
  }

  public delete(
    id: ExampleKindID,
  ): ResultAsync<void, ExampleKindNotFoundError | ExampleKindInUseError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(DELETE, { id }), error => {
      if (isForeignKeyViolation('examples_example_kind_id_fkey', error)) {
        return new ExampleKindInUseError(id)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row =>
      row === null ? errAsync(new ExampleKindNotFoundError(id)) : okAsync(undefined),
    )
  }
}
