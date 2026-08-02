import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import type { Example } from '#/domain/example/example.js'
import { IExampleRepository } from '#/domain/example/example.repository.interface.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import { ExampleKindReferenceNotFoundError } from '#/domain/example-kind/error/example-kind-reference-not-found.error.js'
import { isForeignKeyViolation } from '#/infrastructure/persistence/error/is-foreign-key-violation.js'

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

  public async get(id: ExampleID): Promise<Example> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(GET, { id })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new ExampleNotFoundError(id)
    }

    return exampleRow.parse(row).toDomain()
  }

  public async getAll(): Promise<Example[]> {
    let rows: unknown[]

    try {
      rows = await this.txHost.tx.manyOrNone<unknown>(GET_ALL)
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    return rows.map(row => exampleRow.parse(row).toDomain())
  }

  public async getMany(ids: ReadonlySet<ExampleID>): Promise<Example[]> {
    if (ids.size === 0) {
      return []
    }

    let rows: unknown[]

    try {
      rows = await this.txHost.tx.manyOrNone<unknown>(GET_MANY, { ids: [...ids] })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    const examples = rows.map(row => exampleRow.parse(row).toDomain())
    const found = new Set(examples.map(example => example.id))
    const missing = ids.difference(found)

    if (missing.size > 0) {
      throw new ExampleNotFoundError([...missing][0])
    }

    return examples
  }

  public async create(example: Example): Promise<Example> {
    const { id, name, kind, url } = example

    let row: unknown

    try {
      row = await this.txHost.tx.one<unknown>(INSERT, { id, name, kind, url })
    } catch (error) {
      if (isUniqueConstraintViolation('examples_pkey', error)) {
        throw new DuplicateExampleIdError(id)
      }
      if (isUniqueConstraintViolation('examples_name', error)) {
        throw new DuplicateExampleNameError(name)
      }
      if (isForeignKeyViolation('examples_kind_fkey', error)) {
        throw new ExampleKindReferenceNotFoundError(kind)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    return exampleRow.parse(row).toDomain()
  }

  public async update(example: Example): Promise<Example> {
    const { id, name, kind, url } = example

    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(UPDATE, { id, name, kind, url })
    } catch (error) {
      if (isUniqueConstraintViolation('examples_name', error)) {
        throw new DuplicateExampleNameError(name)
      }
      if (isForeignKeyViolation('examples_kind_fkey', error)) {
        throw new ExampleKindReferenceNotFoundError(kind)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new ExampleNotFoundError(id)
    }

    return exampleRow.parse(row).toDomain()
  }

  public async delete(id: ExampleID): Promise<void> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(DELETE, { id })
    } catch (error) {
      if (isRestrictViolation('examples_to_skills_example_fkey', error)) {
        throw new ExampleInUseError(id)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new ExampleNotFoundError(id)
    }
  }
}
