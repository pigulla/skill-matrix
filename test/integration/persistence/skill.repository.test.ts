import type { INestApplication } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ExampleReferenceNotFoundError } from '#/domain/example/error/example-reference-not-found.error.js'
import { Example } from '#/domain/example/example.js'
import { asExampleID } from '#/domain/example/example-id.js'
import { DuplicateSkillIdError } from '#/domain/skill/error/duplicate-skill-id.error.js'
import { SkillNotFoundError } from '#/domain/skill/error/skill-not-found.error.js'
import { Skill } from '#/domain/skill/skill.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { SkillRepository } from '#/infrastructure/persistence/skill/skill.repository.js'

import { SkillBuilder } from '../../builder/skill.builder.js'
import {
  ASSOCIATION_ASSERTION_HELPER,
  type AssociationHelper,
} from '../fixture/association-assertion-helper.js'
import {
  ENTITY_ASSERTION_HELPER,
  type EntityAssertionHelper,
} from '../fixture/entity-assertion-helper.js'
import { examples, skills } from '../fixture/fixture.js'
import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

describe('SkillRepository', () => {
  const invalidId = asSkillID('00000000-0003-4000-8000-000000000000')
  const missingExampleId = asExampleID('b0000000-0004-4000-8000-000000000000')
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication
  let skillRepository: SkillRepository
  let entity: EntityAssertionHelper
  let association: AssociationHelper

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({ testName: SkillRepository.name, providers: [SkillRepository] })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    skillRepository = app.get(SkillRepository)
    entity = app.get(ENTITY_ASSERTION_HELPER)
    association = app.get(ASSOCIATION_ASSERTION_HELPER)
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return a skill', async () => {
      await expect(skillRepository.get(skills.backendDevelopment.id)).resolves.toEqual(
        skills.backendDevelopment,
      )
    })

    it('should throw when the skill does not exist', async () => {
      await expect(skillRepository.get(invalidId)).rejects.toThrow(SkillNotFoundError)
    })
  })

  describe('getAll', () => {
    it('should return all skills', async () => {
      await expect(skillRepository.getAll()).resolves.to.have.deep.members(Object.values(skills))
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

      await expect(skillRepository.create(skill)).resolves.toEqual(skill)

      await entity(Skill)
        .withId(skill.id)
        .andColumns({
          name: 'Data Modelling',
          description: 'Model data efficiently in various databases.',
        })
        .should.exist()
      await association
        .from(Skill)
        .withId(skill.id)
        .to(Example)
        .withId(examples.postgresql.id)
        .should.exist()
    })

    it('should throw if the id already exists', async () => {
      const skill = SkillBuilder.create({ id: '10000000-0003-4000-8000-5c111a00a100' })

      await expect(skillRepository.create(skill)).rejects.toThrow(DuplicateSkillIdError)
    })

    it('should throw if a referenced example does not exist', async () => {
      const skill = SkillBuilder.create({
        id: '12345678-0003-4000-8000-000000000000',
        name: 'A very important skill',
        exampleIds: [missingExampleId],
      })

      await expect(skillRepository.create(skill)).rejects.toThrow(ExampleReferenceNotFoundError)

      await entity(Skill).withId(skill.id).should.not.exist()
    })
  })

  describe('update', () => {
    it('should update the skills row and replace the example associations', async () => {
      const updated = SkillBuilder.from(skills.backendDevelopment)
        .withName('Backend Engineering')
        .withDescription('Designing and building server-side systems.')
        .withExamples([examples.nextjs.id])
        .build()

      await expect(skillRepository.update(updated)).resolves.toEqual(updated)

      await entity(Skill)
        .withId(updated.id)
        .andColumns({
          name: 'Backend Engineering',
          description: 'Designing and building server-side systems.',
        })
        .should.exist()
      await association
        .from(Skill)
        .withId(updated.id)
        .to(Example)
        .withId(examples.nextjs.id)
        .should.exist()
    })

    it('should throw if the skill does not exist', async () => {
      const skill = SkillBuilder.create({ id: invalidId })

      await expect(skillRepository.update(skill)).rejects.toThrow(SkillNotFoundError)
    })

    it('should throw if a referenced example does not exist', async () => {
      const skill = SkillBuilder.from(skills.frontendDevelopment)
        .withExamples([missingExampleId])
        .build()

      await expect(skillRepository.update(skill)).rejects.toThrow(ExampleReferenceNotFoundError)
    })
  })

  describe('delete', () => {
    it('should delete the skill, cascade its joins, and keep the shared examples', async () => {
      await expect(skillRepository.delete(skills.frontendDevelopment.id)).resolves.toBeUndefined()

      await entity(Skill).withId(skills.frontendDevelopment.id).should.not.exist()
      await association.from(Skill).withId(skills.frontendDevelopment.id).to(Example).should.exist()
    })

    it('should throw when the skill does not exist', async () => {
      await expect(skillRepository.delete(invalidId)).rejects.toThrow(SkillNotFoundError)
    })
  })
})
