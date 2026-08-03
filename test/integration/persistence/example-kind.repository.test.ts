import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { DuplicateExampleKindError } from '#/domain/example-kind/error/duplicate-example-kind.error.js'
import { ExampleKindInUseError } from '#/domain/example-kind/error/example-kind-in-use.error.js'
import { ExampleKindNotFoundError } from '#/domain/example-kind/error/example-kind-not-found.error.js'
import { asExampleKind } from '#/domain/example-kind/example-kind.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ExampleKindRepository } from '#/infrastructure/persistence/example-kind/example-kind.repository.js'

import { exampleKinds } from '../fixture/fixture.js'
import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

const { TECHNOLOGY, CONCEPT } = exampleKinds

describe('ExampleKindRepository', () => {
  const missingKind = asExampleKind('missing')
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication
  let exampleKindRepository: ExampleKindRepository
  let db: Database

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: ExampleKindRepository.name,
        providers: [ExampleKindRepository],
        exports: [ExampleKindRepository],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    exampleKindRepository = app.get(ExampleKindRepository)
    db = app.get(IConnectionProvider).database
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return the example kind', async () => {
      const result = await exampleKindRepository.get(TECHNOLOGY)

      expect(result._unsafeUnwrap()).toEqual(TECHNOLOGY)
    })

    it('should return ExampleKindNotFoundError when the example kind does not exist', async () => {
      const result = await exampleKindRepository.get(missingKind)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ExampleKindNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.get(TECHNOLOGY)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('getAll', () => {
    it('should return all example kinds ordered by kind', async () => {
      const result = await exampleKindRepository.getAll()

      expect(result._unsafeUnwrap()).toEqual(Object.values(exampleKinds).sort())
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('create', () => {
    it('should insert the example kind', async () => {
      const tool = asExampleKind('tool')

      const result = await exampleKindRepository.create(tool)

      expect(result._unsafeUnwrap()).toEqual(tool)

      await expect(
        db.oneOrNone('SELECT * FROM example_kinds WHERE kind=$(kind)', { kind: tool }),
      ).resolves.toMatchObject({ kind: tool })
    })

    it('should return DuplicateExampleKindError if the kind already exists', async () => {
      const result = await exampleKindRepository.create(TECHNOLOGY)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateExampleKindError)
    })

    it('should return DuplicateExampleKindError if the kind already exists', async () => {
      const result = await exampleKindRepository.create(TECHNOLOGY)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateExampleKindError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.create(asExampleKind('tool'))).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('delete', () => {
    it('should delete an unreferenced example kind', async () => {
      const result = await exampleKindRepository.delete(CONCEPT)

      expect(result._unsafeUnwrap()).toBeUndefined()

      await expect(
        db.oneOrNone('SELECT * FROM example_kinds WHERE kind=$(kind)', { kind: CONCEPT }),
      ).resolves.toBeNull()
    })

    it('should return ExampleKindInUseError if the example kind is referenced by an example', async () => {
      const result = await exampleKindRepository.delete(TECHNOLOGY)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ExampleKindInUseError)
    })

    it('should return ExampleKindNotFoundError if the example kind does not exist', async () => {
      const result = await exampleKindRepository.delete(missingKind)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ExampleKindNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.delete(CONCEPT)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })
})
