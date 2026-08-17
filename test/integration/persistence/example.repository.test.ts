import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import dayjs from 'dayjs'
import { err, type Ok, ok } from 'neverthrow'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ITimeProvider } from '#/application/time-provider.interface.js'
import { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import { ExampleConcurrencyError } from '#/domain/example/error/example-concurrency.error.js'
import { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import { ExampleKindReferenceNotFoundError } from '#/domain/example/kind/error/example-kind-reference-not-found.error.js'
import { toConcurrencyToken } from '#/infrastructure/persistence/concurrency-token.codec.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ExampleRepository } from '#/infrastructure/persistence/example/example.repository.js'
import { mockTimeProvider, type TimeProviderMock } from '#/mocks.js'

import { ExampleBuilder } from '../../builder/example.builder.js'
import { STALE_CONCURRENCY_TOKEN } from '../../util/concurrency-tokens.js'
import { UNKNOWN_EXAMPLE_ID, UNKNOWN_EXAMPLE_KIND_ID } from '../../util/entity-ids.js'
import { exampleKinds, examples } from '../fixture/fixture.js'
import { type ETags, getETags } from '../fixture/get-etags.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('ExampleRepository', () => {
  const integrationTest = setupIntegrationTest()
  const now = dayjs('2026-01-01T00:00:00.000Z')

  let app: INestApplication
  let exampleRepository: ExampleRepository
  let timeProviderMock: TimeProviderMock
  let db: Database
  let etags: ETags

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    timeProviderMock = mockTimeProvider(now)

    const module = await integrationTest
      .createModule({
        testName: ExampleRepository.name,
        providers: [ExampleRepository, { provide: ITimeProvider, useValue: timeProviderMock }],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    exampleRepository = app.get(ExampleRepository)
    db = app.get(IConnectionProvider).database
    etags = await getETags(db)
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return the example and its token', async () => {
      const result = await exampleRepository.get(examples.nestjs.id)

      expect(result).toEqual(
        ok({
          value: examples.nestjs,
          token: etags.examples[examples.nestjs.id].token,
        }),
      )
    })

    it('should return ExampleNotFoundError if the example does not exist', async () => {
      const result = await exampleRepository.get(UNKNOWN_EXAMPLE_ID)

      expect(result).toEqual(err(new ExampleNotFoundError(UNKNOWN_EXAMPLE_ID)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.get(examples.nestjs.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('getAll', () => {
    it('should return all examples', async () => {
      const result = await exampleRepository.getAll()

      expect(result.isOk()).toBe(true)
      expect((result as Ok<unknown, unknown>).value).to.have.deep.members(Object.values(examples))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
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

      expect(result).toEqual(
        ok({
          value: graphql,
          token: toConcurrencyToken(now),
        }),
      )

      await expect(
        db.oneOrNone('SELECT * FROM examples WHERE id=$(id)', { id: graphql.id }),
      ).resolves.toMatchObject({
        name: graphql.name,
        example_kind_id: graphql.exampleKindId,
        url: graphql.url,
        last_updated: now,
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

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
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
      const later = now.add(5, 'minutes')
      const updated = ExampleBuilder.from(examples.nestjs).withUrl(null).build()

      timeProviderMock.now.mockReturnValue(later)

      const result = await exampleRepository.update(
        updated,
        etags.examples[examples.nestjs.id].token,
      )

      expect(result).toEqual(
        ok({
          value: updated,
          token: toConcurrencyToken(later),
        }),
      )

      await expect(
        db.oneOrNone('SELECT * FROM examples WHERE id=$(id)', { id: updated.id }),
      ).resolves.toMatchObject({
        name: updated.name,
        example_kind_id: updated.exampleKindId,
        url: updated.url,
        last_updated: later,
      })
    })

    it('should return ExampleConcurrencyError if the token does not match', async () => {
      const result = await exampleRepository.update(
        ExampleBuilder.from(examples.nestjs).withUrl(null).build(),
        STALE_CONCURRENCY_TOKEN,
      )

      expect(result).toEqual(err(new ExampleConcurrencyError(examples.nestjs.id)))
    })

    it('should return DuplicateExampleNameError if the name already exists', async () => {
      const currentToken = etags.examples[examples.nestjs.id].token
      const conflict = ExampleBuilder.from(examples.nestjs)
        .withName(examples.postgresql.name)
        .build()

      const result = await exampleRepository.update(conflict, currentToken)

      expect(result).toEqual(err(new DuplicateExampleNameError(examples.postgresql.name)))
    })

    it('should return ExampleNotFoundError if the example does not exist', async () => {
      const ghost = ExampleBuilder.create({
        id: UNKNOWN_EXAMPLE_ID,
        name: 'Ghost',
        exampleKindId: exampleKinds.concept.id,
      })

      const result = await exampleRepository.update(ghost, toConcurrencyToken(now))

      expect(result).toEqual(err(new ExampleNotFoundError(UNKNOWN_EXAMPLE_ID)))
    })

    it('should return ExampleKindReferenceNotFoundError if the example kind does not exist', async () => {
      const currentToken = etags.examples[examples.cobol.id].token
      const invalid = ExampleBuilder.from(examples.cobol)
        .withExampleKindId(UNKNOWN_EXAMPLE_KIND_ID)
        .build()

      const result = await exampleRepository.update(invalid, currentToken)

      expect(result).toEqual(err(new ExampleKindReferenceNotFoundError(UNKNOWN_EXAMPLE_KIND_ID)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const currentToken = etags.examples[examples.nestjs.id].token
      const updated = ExampleBuilder.from(examples.nestjs).withUrl(null).build()

      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.update(updated, currentToken)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('delete', () => {
    it('should delete an unreferenced example', async () => {
      const currentToken = etags.examples[examples.cobol.id].token

      const result = await exampleRepository.delete(examples.cobol.id, currentToken)

      expect(result).toEqual(ok(undefined))

      await expect(
        db.oneOrNone('SELECT * FROM examples WHERE id=$(id)', { id: examples.cobol.id }),
      ).resolves.toBeNull()
    })

    it('should return ExampleConcurrencyError if the token does not match', async () => {
      const result = await exampleRepository.delete(examples.cobol.id, STALE_CONCURRENCY_TOKEN)

      expect(result).toEqual(err(new ExampleConcurrencyError(examples.cobol.id)))
    })

    it('should return ExampleInUseError if the example is referenced by a skill', async () => {
      const currentToken = etags.examples[examples.nestjs.id].token

      const result = await exampleRepository.delete(examples.nestjs.id, currentToken)

      expect(result).toEqual(err(new ExampleInUseError(examples.nestjs.id)))
    })

    it('should return ExampleNotFoundError if the example does not exist', async () => {
      const result = await exampleRepository.delete(UNKNOWN_EXAMPLE_ID, toConcurrencyToken(now))

      expect(result).toEqual(err(new ExampleNotFoundError(UNKNOWN_EXAMPLE_ID)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const currentToken = etags.examples[examples.cobol.id].token

      await db.none('ALTER TABLE examples RENAME TO examples_renamed')

      await expect(exampleRepository.delete(examples.cobol.id, currentToken)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })
})
