import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ExampleReferenceNotFoundError } from '#/domain/example/error/example-reference-not-found.error.js'
import { asExampleID } from '#/domain/example/example-id.js'
import { DuplicateSkillIdError } from '#/domain/skill/error/duplicate-skill-id.error.js'
import { SkillNotFoundError } from '#/domain/skill/error/skill-not-found.error.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { SkillRepository } from '#/infrastructure/persistence/skill/skill.repository.js'

import { SkillBuilder } from '../../builder/skill.builder.js'
import { by } from '../../util/sort-by-id.js'
import { examples, skills } from '../fixture/fixture.js'
import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

const byExampleId = by('example_id')

describe('SkillRepository', () => {
  const invalidId = asSkillID('00000000-0003-4000-8000-000000000000')
  const missingExampleId = asExampleID('b0000000-0004-4000-8000-000000000000')
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication
  let skillRepository: SkillRepository
  let db: Database

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({ testName: SkillRepository.name, providers: [SkillRepository] })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    skillRepository = app.get(SkillRepository)
    db = app.get(IConnectionProvider).database
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return a skill', async () => {
      const result = await skillRepository.get(skills.backendDevelopment.id)

      expect(result._unsafeUnwrap()).toEqual(skills.backendDevelopment)
    })

    it('should return SkillNotFoundError when the skill does not exist', async () => {
      const result = await skillRepository.get(invalidId)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(SkillNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none(
        'ALTER VIEW view_skills_with_examples RENAME TO view_skills_with_examples_renamed',
      )

      await expect(skillRepository.get(skills.backendDevelopment.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('getAll', () => {
    it('should return all skills', async () => {
      const result = await skillRepository.getAll()

      expect(result._unsafeUnwrap()).to.have.deep.members(Object.values(skills))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none(
        'ALTER VIEW view_skills_with_examples RENAME TO view_skills_with_examples_renamed',
      )

      await expect(skillRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('create', () => {
    it('should insert the skills row and the example associations', async () => {
      const skill = SkillBuilder.create({
        id: '12345678-0003-4000-8000-000000000000',
        name: 'Data Modelling',
        description: 'Model data efficiently in various databases.',
        exampleIds: [examples.postgresql.id],
      })

      const result = await skillRepository.create(skill)

      expect(result._unsafeUnwrap()).toEqual(skill)

      await expect(
        db.oneOrNone('SELECT * FROM skills WHERE id=$(id)', { id: skill.id }),
      ).resolves.toMatchObject({
        name: skill.name,
        description: skill.description,
      })
      await expect(
        db.manyOrNone(
          'SELECT example_id FROM examples_to_skills WHERE skill_id=$(id) ORDER BY example_id',
          { id: skill.id },
        ),
      ).resolves.toEqual(
        [
          {
            example_id: examples.postgresql.id,
          },
        ].sort(byExampleId),
      )
    })

    it('should return DuplicateSkillIdError if the id already exists', async () => {
      const skill = SkillBuilder.create({ id: '33333333-0003-4000-8000-222222222222' })

      const result = await skillRepository.create(skill)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateSkillIdError)
    })

    it('should return ExampleReferenceNotFoundError if a referenced example does not exist', async () => {
      const skill = SkillBuilder.create({
        id: '12345678-0003-4000-8000-000000000000',
        name: 'A very important skill',
        exampleIds: [missingExampleId],
      })

      const result = await skillRepository.create(skill)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ExampleReferenceNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the skill insert fails', async () => {
      const skill = SkillBuilder.create({ id: '12345678-0003-4000-8000-000000000000' })

      await db.none('ALTER TABLE skills RENAME TO skills_renamed')

      await expect(skillRepository.create(skill)).rejects.toThrow(UnexpectedPersistenceError)
    })

    it('should throw UnexpectedPersistenceError when clearing the example associations fails', async () => {
      const skill = SkillBuilder.create({
        id: '12345678-0003-4000-8000-000000000000',
        name: 'A brand new skill',
      })

      await db.none('ALTER TABLE examples_to_skills RENAME TO examples_to_skills_renamed')

      await expect(skillRepository.create(skill)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('update', () => {
    it('should update the skill', async () => {
      const updated = SkillBuilder.from(skills.backendDevelopment)
        .withName('Backend Engineering')
        .withDescription('Designing and building server-side systems.')
        .withExamples([examples.react.id, examples.postgresql.id])
        .build()

      const result = await skillRepository.update(updated)

      expect(result._unsafeUnwrap()).toEqual(updated)

      await expect(
        db.oneOrNone('SELECT * FROM skills WHERE id=$(id)', { id: updated.id }),
      ).resolves.toMatchObject({
        name: updated.name,
        description: updated.description,
      })
      await expect(
        db.manyOrNone(
          'SELECT example_id FROM examples_to_skills WHERE skill_id=$(id) ORDER BY example_id',
          { id: updated.id },
        ),
      ).resolves.toEqual(
        [
          {
            example_id: examples.react.id,
          },
          {
            example_id: examples.postgresql.id,
          },
        ].sort(byExampleId),
      )
    })

    it('should return SkillNotFoundError if the skill does not exist', async () => {
      const skill = SkillBuilder.create({ id: invalidId })

      const result = await skillRepository.update(skill)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(SkillNotFoundError)
    })

    it('should return ExampleReferenceNotFoundError if a referenced example does not exist', async () => {
      const skill = SkillBuilder.from(skills.frontendDevelopment)
        .withExamples([missingExampleId])
        .build()

      const result = await skillRepository.update(skill)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ExampleReferenceNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the skill update fails', async () => {
      const updated = SkillBuilder.from(skills.backendDevelopment).withName('Renamed').build()

      await db.none('ALTER TABLE skills RENAME TO skills_renamed')

      await expect(skillRepository.update(updated)).rejects.toThrow(UnexpectedPersistenceError)
    })

    it('should throw UnexpectedPersistenceError when associating an example fails', async () => {
      const updated = SkillBuilder.from(skills.backendDevelopment)
        .withExamples([examples.react.id])
        .build()

      await db.none(
        'ALTER TABLE examples_to_skills ADD CONSTRAINT force_failure CHECK (FALSE) NOT VALID',
      )

      await expect(skillRepository.update(updated)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('delete', () => {
    it('should delete the skill', async () => {
      const result = await skillRepository.delete(skills.qualityAssurance.id)

      expect(result._unsafeUnwrap()).toBeUndefined()

      await expect(
        db.oneOrNone('SELECT * FROM skills WHERE id=$(id)', { id: skills.qualityAssurance.id }),
      ).resolves.toBeNull()

      await expect(
        db.manyOrNone(
          'SELECT example_id FROM examples_to_skills WHERE skill_id=$(id) ORDER BY example_id',
          { id: skills.qualityAssurance.id },
        ),
      ).resolves.toEqual([])
    })

    it('should return SkillNotFoundError when the skill does not exist', async () => {
      const result = await skillRepository.delete(invalidId)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(SkillNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE skills RENAME TO skills_renamed')

      await expect(skillRepository.delete(skills.qualityAssurance.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })
})
