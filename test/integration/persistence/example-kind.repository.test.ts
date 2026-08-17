import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import dayjs from 'dayjs'
import { err, type Ok, ok } from 'neverthrow'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ITimeProvider } from '#/application/time-provider.interface.js'
import { DuplicateExampleKindIdError } from '#/domain/example/kind/error/duplicate-example-kind-id.error.js'
import { DuplicateExampleKindNameError } from '#/domain/example/kind/error/duplicate-example-kind-name.error.js'
import { ExampleKindConcurrencyError } from '#/domain/example/kind/error/example-kind-concurrency.error.js'
import { ExampleKindInUseError } from '#/domain/example/kind/error/example-kind-in-use.error.js'
import { ExampleKindNotFoundError } from '#/domain/example/kind/error/example-kind-not-found.error.js'
import { toConcurrencyToken } from '#/infrastructure/persistence/concurrency-token.codec.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ExampleKindRepository } from '#/infrastructure/persistence/example/kind/example-kind.repository.js'
import { mockTimeProvider, type TimeProviderMock } from '#/mocks.js'

import { ExampleKindBuilder } from '../../builder/example-kind.builder.js'
import { STALE_CONCURRENCY_TOKEN } from '../../util/concurrency-tokens.js'
import { UNKNOWN_EXAMPLE_KIND_ID } from '../../util/entity-ids.js'
import { exampleKinds } from '../fixture/fixture.js'
import { type ETags, getETags } from '../fixture/get-etags.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('ExampleKindRepository', () => {
  const integrationTest = setupIntegrationTest()
  const now = dayjs('2026-01-01T00:00:00.000Z')

  let app: INestApplication
  let exampleKindRepository: ExampleKindRepository
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
        testName: ExampleKindRepository.name,
        providers: [ExampleKindRepository, { provide: ITimeProvider, useValue: timeProviderMock }],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    exampleKindRepository = app.get(ExampleKindRepository)
    db = app.get(IConnectionProvider).database
    etags = await getETags(db)
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return the example kind and its token', async () => {
      const result = await exampleKindRepository.get(exampleKinds.technology.id)

      expect(result).toEqual(
        ok({
          value: exampleKinds.technology,
          token: etags.exampleKinds[exampleKinds.technology.id].token,
        }),
      )
    })

    it('should return ExampleKindNotFoundError if the example kind does not exist', async () => {
      const result = await exampleKindRepository.get(UNKNOWN_EXAMPLE_KIND_ID)

      expect(result).toEqual(err(new ExampleKindNotFoundError(UNKNOWN_EXAMPLE_KIND_ID)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.get(exampleKinds.technology.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('getAll', () => {
    it('should return all example kinds', async () => {
      const result = await exampleKindRepository.getAll()

      expect(result.isOk()).toBe(true)
      expect((result as Ok<unknown, unknown>).value).to.have.deep.members(
        Object.values(exampleKinds),
      )
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('create', () => {
    it('should create an example kind', async () => {
      const exampleKind = ExampleKindBuilder.create({ name: 'Tool' })

      const result = await exampleKindRepository.create(exampleKind)

      expect(result).toEqual(
        ok({
          value: exampleKind,
          token: toConcurrencyToken(now),
        }),
      )

      await expect(
        db.oneOrNone('SELECT * FROM example_kinds WHERE id=$(id)', { id: exampleKind.id }),
      ).resolves.toMatchObject({ name: exampleKind.name, last_updated: now })
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

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const exampleKind = ExampleKindBuilder.create({ name: 'Tool' })

      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.create(exampleKind)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('update', () => {
    it('should update an example kind', async () => {
      const later = now.add(5, 'minutes')
      const updated = ExampleKindBuilder.from(exampleKinds.pattern)
        .withName('Design Pattern')
        .build()

      timeProviderMock.now.mockReturnValue(later)

      const result = await exampleKindRepository.update(
        updated,
        etags.exampleKinds[exampleKinds.pattern.id].token,
      )

      expect(result).toEqual(
        ok({
          value: updated,
          token: toConcurrencyToken(later),
        }),
      )

      await expect(
        db.oneOrNone('SELECT * FROM example_kinds WHERE id=$(id)', { id: updated.id }),
      ).resolves.toMatchObject({ name: updated.name, last_updated: later })
    })

    it('should return ExampleKindConcurrencyError if the token does not match', async () => {
      const updated = ExampleKindBuilder.from(exampleKinds.pattern)
        .withName('Design Pattern')
        .build()

      const result = await exampleKindRepository.update(updated, STALE_CONCURRENCY_TOKEN)

      expect(result).toEqual(err(new ExampleKindConcurrencyError(exampleKinds.pattern.id)))
    })

    it('should return ExampleKindNotFoundError if the example kind does not exist', async () => {
      const exampleKind = new ExampleKindBuilder().withId(UNKNOWN_EXAMPLE_KIND_ID).build()

      const result = await exampleKindRepository.update(exampleKind, toConcurrencyToken(now))

      expect(result).toEqual(err(new ExampleKindNotFoundError(UNKNOWN_EXAMPLE_KIND_ID)))
    })

    it('should return DuplicateExampleKindNameError if the name already exists', async () => {
      const currentToken = etags.exampleKinds[exampleKinds.pattern.id].token
      const updated = ExampleKindBuilder.from(exampleKinds.pattern)
        .withName(exampleKinds.technology.name)
        .build()

      const result = await exampleKindRepository.update(updated, currentToken)

      expect(result).toEqual(err(new DuplicateExampleKindNameError(exampleKinds.technology.name)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const currentToken = etags.exampleKinds[exampleKinds.pattern.id].token
      const updated = ExampleKindBuilder.from(exampleKinds.pattern)
        .withName('Design Pattern')
        .build()

      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(exampleKindRepository.update(updated, currentToken)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('delete', () => {
    it('should delete an unreferenced example kind', async () => {
      const currentToken = etags.exampleKinds[exampleKinds.concept.id].token

      const result = await exampleKindRepository.delete(exampleKinds.concept.id, currentToken)

      expect(result).toEqual(ok(undefined))

      await expect(
        db.oneOrNone('SELECT * FROM example_kinds WHERE id=$(id)', { id: exampleKinds.concept.id }),
      ).resolves.toBeNull()
    })

    it('should return ExampleKindConcurrencyError if the token does not match', async () => {
      const result = await exampleKindRepository.delete(
        exampleKinds.concept.id,
        STALE_CONCURRENCY_TOKEN,
      )

      expect(result).toEqual(err(new ExampleKindConcurrencyError(exampleKinds.concept.id)))
    })

    it('should return ExampleKindInUseError if the example kind is referenced by an example', async () => {
      const currentToken = etags.exampleKinds[exampleKinds.technology.id].token

      const result = await exampleKindRepository.delete(exampleKinds.technology.id, currentToken)

      expect(result).toEqual(err(new ExampleKindInUseError(exampleKinds.technology.id)))
    })

    it('should return ExampleKindNotFoundError if the example kind does not exist', async () => {
      const result = await exampleKindRepository.delete(
        UNKNOWN_EXAMPLE_KIND_ID,
        toConcurrencyToken(now),
      )

      expect(result).toEqual(err(new ExampleKindNotFoundError(UNKNOWN_EXAMPLE_KIND_ID)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const currentToken = etags.exampleKinds[exampleKinds.concept.id].token

      await db.none('ALTER TABLE example_kinds RENAME TO example_kinds_renamed')

      await expect(
        exampleKindRepository.delete(exampleKinds.concept.id, currentToken),
      ).rejects.toThrow(UnexpectedPersistenceError)
    })
  })
})
