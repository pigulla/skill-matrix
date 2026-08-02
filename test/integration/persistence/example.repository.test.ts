import type { INestApplication } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import { Example } from '#/domain/example/example.js'
import { asExampleID, type ExampleID } from '#/domain/example/example-id.js'
import { ExampleRepository } from '#/infrastructure/persistence/example/example.repository.js'

import { ExampleBuilder } from '../../builder/example.builder.js'
import {
  ENTITY_ASSERTION_HELPER,
  type EntityAssertionHelper,
} from '../fixture/entity-assertion-helper.js'
import { exampleKinds, examples } from '../fixture/fixture.js'
import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

describe('ExampleRepository', () => {
  const missingId = asExampleID('b0000000-0004-4000-8000-000000000000')
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication
  let exampleRepository: ExampleRepository
  let entity: EntityAssertionHelper

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
    entity = app.get(ENTITY_ASSERTION_HELPER)
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return the example', async () => {
      await expect(exampleRepository.get(examples.nestjs.id)).resolves.toEqual(examples.nestjs)
    })

    it('should throw when the example does not exist', async () => {
      await expect(exampleRepository.get(missingId)).rejects.toThrow(ExampleNotFoundError)
    })
  })

  describe('getAll', () => {
    it('should return all examples', async () => {
      await expect(exampleRepository.getAll()).resolves.to.have.deep.members(
        Object.values(examples),
      )
    })
  })

  describe('getMany', () => {
    it('should return the requested examples ordered by name', async () => {
      await expect(
        exampleRepository.getMany(new Set([examples.postgresql.id, examples.nestjs.id])),
      ).resolves.toEqual([examples.nestjs, examples.postgresql])
    })

    it('should return an empty array for an empty set', async () => {
      await expect(exampleRepository.getMany(new Set<ExampleID>())).resolves.toEqual([])
    })

    it('should throw when any requested example does not exist', async () => {
      await expect(
        exampleRepository.getMany(new Set([examples.nestjs.id, missingId])),
      ).rejects.toThrow(ExampleNotFoundError)
    })
  })

  describe('create', () => {
    it('should insert the example', async () => {
      const graphql = ExampleBuilder.create({
        id: '12345678-0004-4000-8000-000000000000',
        name: 'GraphQL',
        kind: exampleKinds.TECHNOLOGY,
        url: 'https://graphql.org',
      })

      await expect(exampleRepository.create(graphql)).resolves.toEqual(graphql)

      await entity(Example)
        .withId(graphql.id)
        .andColumns({
          name: graphql.name,
          kind: graphql.kind,
          url: graphql.url,
        })
        .should.exist()
    })

    it('should throw if the id already exists', async () => {
      await expect(exampleRepository.create(examples.nextjs)).rejects.toThrow(
        DuplicateExampleIdError,
      )
    })

    it('should throw if the name already exists', async () => {
      const duplicate = ExampleBuilder.create({
        id: '12345678-0004-4000-8000-000000000001',
        name: examples.nestjs.name,
        kind: exampleKinds.TECHNOLOGY,
      })

      await expect(exampleRepository.create(duplicate)).rejects.toThrow(DuplicateExampleNameError)
      await entity(Example).withId(duplicate.id).should.not.exist()
    })
  })

  describe('update', () => {
    it('should update the example', async () => {
      const updated = ExampleBuilder.from(examples.nestjs).withUrl(null).build()

      await expect(exampleRepository.update(updated)).resolves.toEqual(updated)

      await entity(Example)
        .withId(updated.id)
        .andColumns({
          name: updated.name,
          kind: updated.kind,
          url: updated.url,
        })
        .should.exist()
    })

    it('should throw if the name already exists', async () => {
      const conflict = ExampleBuilder.from(examples.nestjs)
        .withName(examples.postgresql.name)
        .build()

      await expect(exampleRepository.update(conflict)).rejects.toThrow(DuplicateExampleNameError)
      await entity(Example)
        .withId(conflict.id)
        .andColumns({
          name: examples.nestjs.name,
        })
        .should.exist()
    })

    it('should throw if the example does not exist', async () => {
      const ghost = ExampleBuilder.create({ id: missingId, name: 'Ghost', kind: 'concept' })

      await expect(exampleRepository.update(ghost)).rejects.toThrow(ExampleNotFoundError)
    })
  })

  describe('delete', () => {
    it('should delete an unreferenced example', async () => {
      await expect(exampleRepository.delete(examples.cobol.id)).resolves.toBeUndefined()

      await entity(Example).withId(examples.cobol.id).should.not.exist()
    })

    it('should throw if the example is referenced by a skill', async () => {
      await expect(exampleRepository.delete(examples.nestjs.id)).rejects.toThrow(ExampleInUseError)

      await entity(Example).withId(examples.nestjs.id).should.exist()
    })

    it('should throw if the example does not exist', async () => {
      await expect(exampleRepository.delete(missingId)).rejects.toThrow(ExampleNotFoundError)
    })
  })
})
