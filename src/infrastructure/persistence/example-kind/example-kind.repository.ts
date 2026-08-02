import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'

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

  public async get(kind: ExampleKind): Promise<ExampleKind> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(GET, { kind })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new ExampleKindNotFoundError(kind)
    }

    return exampleKindRow.parse(row).toDomain()
  }

  public async getAll(): Promise<ExampleKind[]> {
    let rows: unknown[]

    try {
      rows = await this.txHost.tx.manyOrNone<unknown>(GET_ALL)
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    return rows.map(row => exampleKindRow.parse(row).toDomain())
  }

  public async create(kind: ExampleKind): Promise<ExampleKind> {
    let row: unknown

    try {
      row = await this.txHost.tx.one<unknown>(INSERT, { kind })
    } catch (error) {
      if (isUniqueConstraintViolation('example_kinds_pkey', error)) {
        throw new DuplicateExampleKindError(kind)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    return exampleKindRow.parse(row).toDomain()
  }

  public async delete(kind: ExampleKind): Promise<void> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(DELETE, { kind })
    } catch (error) {
      if (isForeignKeyViolation('examples_kind_fkey', error)) {
        throw new ExampleKindInUseError(kind)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new ExampleKindNotFoundError(kind)
    }
  }
}
