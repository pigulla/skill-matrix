import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import dayjs from 'dayjs'
import { err, type Ok, ok } from 'neverthrow'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ITimeProvider } from '#/application/time-provider.interface.js'
import { ExampleReferenceNotFoundError } from '#/domain/example/error/example-reference-not-found.error.js'
import { DuplicateSkillIdError } from '#/domain/skill/error/duplicate-skill-id.error.js'
import { DuplicateSkillNameError } from '#/domain/skill/error/duplicate-skill-name.error.js'
import { SkillConcurrencyError } from '#/domain/skill/error/skill-concurrency.error.js'
import { SkillInUseError } from '#/domain/skill/error/skill-in-use.error.js'
import { SkillNotFoundError } from '#/domain/skill/error/skill-not-found.error.js'
import { toConcurrencyToken } from '#/infrastructure/persistence/concurrency-token.codec.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { SkillRepository } from '#/infrastructure/persistence/skill/skill.repository.js'
import { mockTimeProvider, type TimeProviderMock } from '#/mocks.js'

import { SkillBuilder } from '../../builder/skill.builder.js'
import { STALE_CONCURRENCY_TOKEN } from '../../util/concurrency-tokens.js'
import { UNKNOWN_EXAMPLE_ID, UNKNOWN_SKILL_ID } from '../../util/entity-ids.js'
import { examples, skills } from '../fixture/fixture.js'
import { type ETags, getETags } from '../fixture/get-etags.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('SkillRepository', () => {
  const integrationTest = setupIntegrationTest()
  const now = dayjs('2026-01-01T00:00:00.000Z')

  let app: INestApplication
  let skillRepository: SkillRepository
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
        testName: SkillRepository.name,
        providers: [SkillRepository, { provide: ITimeProvider, useValue: timeProviderMock }],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    skillRepository = app.get(SkillRepository)
    db = app.get(IConnectionProvider).database
    etags = await getETags(db)
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return a skill and its token', async () => {
      const result = await skillRepository.get(skills.backendDevelopment.id)

      expect(result).toEqual(
        ok({
          value: skills.backendDevelopment,
          token: etags.skills[skills.backendDevelopment.id].token,
        }),
      )
    })

    it('should return SkillNotFoundError if the skill does not exist', async () => {
      const result = await skillRepository.get(UNKNOWN_SKILL_ID)

      expect(result).toEqual(err(new SkillNotFoundError(UNKNOWN_SKILL_ID)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
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

      expect(result.isOk()).toBe(true)
      expect((result as Ok<unknown, unknown>).value).to.have.deep.members(Object.values(skills))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      await db.none(
        'ALTER VIEW view_skills_with_examples RENAME TO view_skills_with_examples_renamed',
      )

      await expect(skillRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('create', () => {
    it('should insert the skills row and the example associations', async () => {
      const skill = SkillBuilder.create({
        name: 'Data Modelling',
        description: 'Model data efficiently in various databases.',
        exampleIds: [examples.postgresql.id],
      })

      const result = await skillRepository.create(skill)

      expect(result).toEqual(
        ok({
          value: skill,
          token: toConcurrencyToken(now),
        }),
      )

      await expect(
        db.oneOrNone('SELECT * FROM skills WHERE id=$(id)', { id: skill.id }),
      ).resolves.toMatchObject({
        name: skill.name,
        description: skill.description,
        last_updated: now,
      })
      await expect(
        db.manyOrNone(
          'SELECT example_id FROM examples_to_skills WHERE skill_id=$(id) ORDER BY example_id',
          { id: skill.id },
        ),
      ).resolves.to.have.deep.members([
        {
          example_id: examples.postgresql.id,
        },
      ])
    })

    it('should return DuplicateSkillIdError if the id already exists', async () => {
      const skill = new SkillBuilder().withId(skills.frontendDevelopment.id).build()

      const result = await skillRepository.create(skill)

      expect(result).toEqual(err(new DuplicateSkillIdError(skills.frontendDevelopment.id)))
    })

    it('should return DuplicateSkillNameError if the name already exists', async () => {
      const skill = SkillBuilder.create({
        name: skills.frontendDevelopment.name,
        description: 'Model data efficiently in various databases.',
        exampleIds: [],
      })

      const result = await skillRepository.create(skill)

      expect(result).toEqual(err(new DuplicateSkillNameError(skills.frontendDevelopment.name)))
    })

    it('should return ExampleReferenceNotFoundError if a referenced example does not exist', async () => {
      const skill = SkillBuilder.create({
        name: 'A very important skill',
        exampleIds: [UNKNOWN_EXAMPLE_ID],
      })

      const result = await skillRepository.create(skill)

      expect(result).toEqual(err(new ExampleReferenceNotFoundError(UNKNOWN_EXAMPLE_ID)))
    })

    it('should throw UnexpectedPersistenceError if the skill insert fails', async () => {
      const skill = SkillBuilder.create({ id: UNKNOWN_SKILL_ID })

      await db.none('ALTER TABLE skills RENAME TO skills_renamed')

      await expect(skillRepository.create(skill)).rejects.toThrow(UnexpectedPersistenceError)
    })

    it('should throw UnexpectedPersistenceError if clearing the example associations fails', async () => {
      const skill = SkillBuilder.create({
        id: UNKNOWN_SKILL_ID,
        name: 'A brand new skill',
      })

      await db.none('ALTER TABLE examples_to_skills RENAME TO examples_to_skills_renamed')

      await expect(skillRepository.create(skill)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('update', () => {
    it('should update the skill', async () => {
      const later = now.add(5, 'minutes')
      const updated = SkillBuilder.from(skills.backendDevelopment)
        .withName('Backend Engineering')
        .withDescription('Designing and building server-side systems.')
        .withExamples([examples.react.id, examples.postgresql.id])
        .build()

      timeProviderMock.now.mockReturnValue(later)

      const result = await skillRepository.update(
        updated,
        etags.skills[skills.backendDevelopment.id].token,
      )

      expect(result).toEqual(
        ok({
          value: updated,
          token: toConcurrencyToken(later),
        }),
      )

      await expect(
        db.oneOrNone('SELECT * FROM skills WHERE id=$(id)', { id: updated.id }),
      ).resolves.toMatchObject({
        name: updated.name,
        description: updated.description,
        last_updated: later,
      })
      await expect(
        db.manyOrNone(
          'SELECT example_id FROM examples_to_skills WHERE skill_id=$(id) ORDER BY example_id',
          { id: updated.id },
        ),
      ).resolves.to.have.deep.members([
        {
          example_id: examples.react.id,
        },
        {
          example_id: examples.postgresql.id,
        },
      ])
    })

    it('should return SkillConcurrencyError if the token does not match', async () => {
      const result = await skillRepository.update(
        SkillBuilder.from(skills.backendDevelopment).withName('Renamed').build(),
        STALE_CONCURRENCY_TOKEN,
      )

      expect(result).toEqual(err(new SkillConcurrencyError(skills.backendDevelopment.id)))
    })

    it('should return DuplicateSkillNameError if the name already exists', async () => {
      const result = await skillRepository.update(
        SkillBuilder.from(skills.backendDevelopment)
          .withName(skills.frontendDevelopment.name)
          .build(),
        etags.skills[skills.backendDevelopment.id].token,
      )

      expect(result).toEqual(err(new DuplicateSkillNameError(skills.frontendDevelopment.name)))
    })

    it('should return SkillNotFoundError if the skill does not exist', async () => {
      const skill = SkillBuilder.create({ id: UNKNOWN_SKILL_ID })

      const result = await skillRepository.update(skill, toConcurrencyToken(now))

      expect(result).toEqual(err(new SkillNotFoundError(UNKNOWN_SKILL_ID)))
    })

    it('should return ExampleReferenceNotFoundError if a referenced example does not exist', async () => {
      const currentToken = etags.skills[skills.frontendDevelopment.id].token
      const skill = SkillBuilder.from(skills.frontendDevelopment)
        .withExamples([UNKNOWN_EXAMPLE_ID])
        .build()

      const result = await skillRepository.update(skill, currentToken)

      expect(result).toEqual(err(new ExampleReferenceNotFoundError(UNKNOWN_EXAMPLE_ID)))
    })

    it('should throw UnexpectedPersistenceError if the skill update fails', async () => {
      const currentToken = etags.skills[skills.backendDevelopment.id].token
      const updated = SkillBuilder.from(skills.backendDevelopment).withName('Renamed').build()

      await db.none('ALTER TABLE skills RENAME TO skills_renamed')

      await expect(skillRepository.update(updated, currentToken)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })

    it('should throw UnexpectedPersistenceError if associating an example fails', async () => {
      const updated = SkillBuilder.from(skills.backendDevelopment)
        .withExamples([examples.react.id])
        .build()

      await db.none(
        'ALTER TABLE examples_to_skills ADD CONSTRAINT force_failure CHECK (FALSE) NOT VALID',
      )

      await expect(
        skillRepository.update(updated, etags.skills[skills.backendDevelopment.id].token),
      ).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('delete', () => {
    it('should delete the skill', async () => {
      const result = await skillRepository.delete(
        skills.qualityAssurance.id,
        etags.skills[skills.qualityAssurance.id].token,
      )

      expect(result).toEqual(ok(undefined))

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

    it('should return SkillConcurrencyError if the token does not match', async () => {
      const result = await skillRepository.delete(
        skills.qualityAssurance.id,
        STALE_CONCURRENCY_TOKEN,
      )

      expect(result).toEqual(err(new SkillConcurrencyError(skills.qualityAssurance.id)))
    })

    it('should return SkillNotFoundError if the skill does not exist', async () => {
      const result = await skillRepository.delete(UNKNOWN_SKILL_ID, STALE_CONCURRENCY_TOKEN)

      expect(result).toEqual(err(new SkillNotFoundError(UNKNOWN_SKILL_ID)))
    })

    it('should return SkillInUseError if the skill is referenced by a team', async () => {
      const result = await skillRepository.delete(
        skills.softwareArchitecture.id,
        etags.skills[skills.softwareArchitecture.id].token,
      )

      expect(result).toEqual(err(new SkillInUseError(skills.softwareArchitecture.id)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const currentToken = etags.skills[skills.qualityAssurance.id].token

      await db.none('ALTER TABLE skills RENAME TO skills_renamed')

      await expect(
        skillRepository.delete(skills.qualityAssurance.id, currentToken),
      ).rejects.toThrow(UnexpectedPersistenceError)
    })
  })
})
