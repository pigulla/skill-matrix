import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { err } from 'neverthrow'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { DuplicateExampleKindIdError } from '#/domain/example/kind/error/duplicate-example-kind-id.error.js'
import { DuplicateExampleKindNameError } from '#/domain/example/kind/error/duplicate-example-kind-name.error.js'
import { ExampleKindInUseError } from '#/domain/example/kind/error/example-kind-in-use.error.js'
import { ExampleKindNotFoundError } from '#/domain/example/kind/error/example-kind-not-found.error.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ExampleKindRepository } from '#/infrastructure/persistence/example/kind/example-kind.repository.js'

import { ExampleKindBuilder } from '../../builder/example-kind.builder.js'
import { UNKNOWN_EXAMPLE_KIND_ID } from '../../util/entity-ids.js'
import { byId } from '../../util/sort-by-id.js'
import { exampleKinds } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('ExampleKindRepository', () => {
  const integrationTest = setupIntegrationTest()

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
    it('should return an example kind', async () => {
      const result = await exampleKindRepository.get(exampleKinds.technology.id)

      expect(result._unsafeUnwrap()).toEqual(exampleKinds.technology)
    })

    it('should return ExampleKindNotFoundError when the example kind does not exist', async () => {
      const result = await exampleKindRepository.get(UNKNOWN_EXAMPLE_KIND_ID)

      expect(result).toEqual(err(new ExampleKindNotFoundError(UNKNOWN_EXAMPLE_KIND_ID)))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.get(exampleKinds.technology.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('getAll', () => {
    it('should return all example kinds', async () => {
      const result = await exampleKindRepository.getAll()

      expect(result._unsafeUnwrap().sort(byId)).toEqual(Object.values(exampleKinds).sort(byId))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('create', () => {
    it('should create an example kind', async () => {
      const exampleKind = ExampleKindBuilder.create({ name: 'Tool' })

      const result = await exampleKindRepository.create(exampleKind)

      expect(result._unsafeUnwrap()).toEqual(exampleKind)

      await expect(
        db.oneOrNone('SELECT * FROM example_kinds WHERE id=$(id)', { id: exampleKind.id }),
      ).resolves.toMatchObject({ name: exampleKind.name })
    })

    it('should return DuplicateExampleKindIdError if the id already exists', async () => {
      const exampleKind = ExampleKindBuilder.from(exampleKinds.technology)
        .withName('Different')
        .build()

      const result = await exampleKindRepository.create(exampleKind)

      expect(result).toEqual(err(new DuplicateExampleKindIdError(exampleKinds.technology.id)))
    })

    it('should return DuplicateExampleKindNameError if the name already exists', async () => {
      const exampleKind = ExampleKindBuilder.create({ name: exampleKinds.technology.name })

      const result = await exampleKindRepository.create(exampleKind)

      expect(result).toEqual(err(new DuplicateExampleKindNameError(exampleKinds.technology.name)))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const exampleKind = ExampleKindBuilder.create({ name: 'Tool' })

      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.create(exampleKind)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('update', () => {
    it('should update an example kind', async () => {
      const updated = ExampleKindBuilder.from(exampleKinds.pattern)
        .withName('Design Pattern')
        .build()

      const result = await exampleKindRepository.update(updated)

      expect(result._unsafeUnwrap()).toEqual(updated)

      await expect(
        db.oneOrNone('SELECT * FROM example_kinds WHERE id=$(id)', { id: updated.id }),
      ).resolves.toMatchObject({ name: updated.name })
    })

    it('should return ExampleKindNotFoundError if the example kind does not exist', async () => {
      const exampleKind = new ExampleKindBuilder().withId(UNKNOWN_EXAMPLE_KIND_ID).build()

      const result = await exampleKindRepository.update(exampleKind)

      expect(result).toEqual(err(new ExampleKindNotFoundError(UNKNOWN_EXAMPLE_KIND_ID)))
    })

    it('should return DuplicateExampleKindNameError if the name is taken', async () => {
      const updated = ExampleKindBuilder.from(exampleKinds.pattern)
        .withName(exampleKinds.technology.name)
        .build()

      const result = await exampleKindRepository.update(updated)

      expect(result).toEqual(err(new DuplicateExampleKindNameError(exampleKinds.technology.name)))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const updated = ExampleKindBuilder.from(exampleKinds.pattern)
        .withName('Design Pattern')
        .build()

      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.update(updated)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('delete', () => {
    it('should delete an unreferenced example kind', async () => {
      const result = await exampleKindRepository.delete(exampleKinds.concept.id)

      expect(result.isOk()).toBe(true)

      await expect(
        db.oneOrNone('SELECT * FROM example_kinds WHERE id=$(id)', { id: exampleKinds.concept.id }),
      ).resolves.toBeNull()
    })

    it('should return ExampleKindInUseError if the example kind is referenced by an example', async () => {
      const result = await exampleKindRepository.delete(exampleKinds.technology.id)

      expect(result).toEqual(err(new ExampleKindInUseError(exampleKinds.technology.id)))
    })

    it('should return ExampleKindNotFoundError if the example kind does not exist', async () => {
      const result = await exampleKindRepository.delete(UNKNOWN_EXAMPLE_KIND_ID)

      expect(result).toEqual(err(new ExampleKindNotFoundError(UNKNOWN_EXAMPLE_KIND_ID)))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.delete(exampleKinds.concept.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })
})
