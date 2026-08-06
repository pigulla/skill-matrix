import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { err } from 'neverthrow'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import { ExampleKindReferenceNotFoundError } from '#/domain/example/kind/error/example-kind-reference-not-found.error.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ExampleRepository } from '#/infrastructure/persistence/example/example.repository.js'

import { ExampleBuilder } from '../../builder/example.builder.js'
import { UNKNOWN_EXAMPLE_ID, UNKNOWN_EXAMPLE_KIND_ID } from '../../util/entity-ids.js'
import { exampleKinds, examples } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('ExampleRepository', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication
  let exampleRepository: ExampleRepository
  let db: Database

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: ExampleRepository.name,
        providers: [ExampleRepository],
        exports: [ExampleRepository],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    exampleRepository = app.get(ExampleRepository)
    db = app.get(IConnectionProvider).database
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return the example', async () => {
      const result = await exampleRepository.get(examples.nestjs.id)

      expect(result._unsafeUnwrap()).toEqual(examples.nestjs)
    })

    it('should return ExampleNotFoundError when the example does not exist', async () => {
      const result = await exampleRepository.get(UNKNOWN_EXAMPLE_ID)

      expect(result).toEqual(err(new ExampleNotFoundError(UNKNOWN_EXAMPLE_ID)))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.get(examples.nestjs.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('getAll', () => {
    it('should return all examples', async () => {
      const result = await exampleRepository.getAll()

      expect(result._unsafeUnwrap()).to.have.deep.members(Object.values(examples))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('getMany', () => {
    it('should return the requested examples ordered by name', async () => {
      const result = await exampleRepository.getMany(
        new Set([examples.postgresql.id, examples.nestjs.id]),
      )

      expect(result._unsafeUnwrap()).toEqual([examples.nestjs, examples.postgresql])
    })

    it('should return an empty array for an empty set', async () => {
      const result = await exampleRepository.getMany(new Set<ExampleID>())

      expect(result._unsafeUnwrap()).toEqual([])
    })

    it('should return ExampleNotFoundError when any requested example does not exist', async () => {
      const result = await exampleRepository.getMany(
        new Set([examples.nestjs.id, UNKNOWN_EXAMPLE_ID]),
      )

      expect(result).toEqual(err(new ExampleNotFoundError(UNKNOWN_EXAMPLE_ID)))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.getMany(new Set([examples.nestjs.id]))).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('create', () => {
    it('should insert the example', async () => {
      const graphql = ExampleBuilder.create({
        name: 'GraphQL',
        exampleKindId: exampleKinds.technology.id,
        url: 'https://graphql.org',
      })

      const result = await exampleRepository.create(graphql)

      expect(result._unsafeUnwrap()).toEqual(graphql)

      await expect(
        db.oneOrNone('SELECT * FROM examples WHERE id=$(id)', { id: graphql.id }),
      ).resolves.toMatchObject({
        name: graphql.name,
        example_kind_id: graphql.exampleKindId,
        url: graphql.url,
      })
    })

    it('should return DuplicateExampleIdError if the id already exists', async () => {
      const result = await exampleRepository.create(examples.react)

      expect(result).toEqual(err(new DuplicateExampleIdError(examples.react.id)))
    })

    it('should return DuplicateExampleNameError if the name already exists', async () => {
      const duplicate = ExampleBuilder.create({
        name: examples.nestjs.name,
        exampleKindId: exampleKinds.technology.id,
      })

      const result = await exampleRepository.create(duplicate)

      expect(result).toEqual(err(new DuplicateExampleNameError(examples.nestjs.name)))
    })

    it('should return ExampleKindReferenceNotFoundError if the example kind does not exist', async () => {
      const graphql = ExampleBuilder.create({
        name: 'GraphQL',
        exampleKindId: UNKNOWN_EXAMPLE_KIND_ID,
        url: 'https://graphql.org',
      })

      const result = await exampleRepository.create(graphql)

      expect(result).toEqual(err(new ExampleKindReferenceNotFoundError(UNKNOWN_EXAMPLE_KIND_ID)))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const graphql = ExampleBuilder.create({
        name: 'GraphQL',
        exampleKindId: exampleKinds.technology.id,
      })

      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.create(graphql)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('update', () => {
    it('should update the example', async () => {
      const updated = ExampleBuilder.from(examples.nestjs).withUrl(null).build()

      const result = await exampleRepository.update(updated)

      expect(result._unsafeUnwrap()).toEqual(updated)

      await expect(
        db.oneOrNone('SELECT * FROM examples WHERE id=$(id)', { id: updated.id }),
      ).resolves.toMatchObject({
        name: updated.name,
        example_kind_id: updated.exampleKindId,
        url: updated.url,
      })
    })

    it('should return DuplicateExampleNameError if the name already exists', async () => {
      const conflict = ExampleBuilder.from(examples.nestjs)
        .withName(examples.postgresql.name)
        .build()

      const result = await exampleRepository.update(conflict)

      expect(result).toEqual(err(new DuplicateExampleNameError(examples.postgresql.name)))
    })

    it('should return ExampleNotFoundError if the example does not exist', async () => {
      const ghost = ExampleBuilder.create({
        id: UNKNOWN_EXAMPLE_ID,
        name: 'Ghost',
        exampleKindId: exampleKinds.concept.id,
      })

      const result = await exampleRepository.update(ghost)

      expect(result).toEqual(err(new ExampleNotFoundError(UNKNOWN_EXAMPLE_ID)))
    })

    it('should return ExampleKindReferenceNotFoundError if the example kind does not exist', async () => {
      const invalid = ExampleBuilder.from(examples.cobol)
        .withExampleKindId(UNKNOWN_EXAMPLE_KIND_ID)
        .build()

      const result = await exampleRepository.update(invalid)

      expect(result).toEqual(err(new ExampleKindReferenceNotFoundError(UNKNOWN_EXAMPLE_KIND_ID)))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const updated = ExampleBuilder.from(examples.nestjs).withUrl(null).build()

      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.update(updated)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('delete', () => {
    it('should delete an unreferenced example', async () => {
      const result = await exampleRepository.delete(examples.cobol.id)

      expect(result.isOk()).toBe(true)

      await expect(
        db.oneOrNone('SELECT * FROM examples WHERE id=$(id)', { id: examples.cobol.id }),
      ).resolves.toBeNull()
    })

    it('should return ExampleInUseError if the example is referenced by a skill', async () => {
      const result = await exampleRepository.delete(examples.nestjs.id)

      expect(result).toEqual(err(new ExampleInUseError(examples.nestjs.id)))
    })

    it('should return ExampleNotFoundError if the example does not exist', async () => {
      const result = await exampleRepository.delete(UNKNOWN_EXAMPLE_ID)

      expect(result).toEqual(err(new ExampleNotFoundError(UNKNOWN_EXAMPLE_ID)))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.delete(examples.cobol.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })
})
