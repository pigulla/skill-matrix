import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import { DuplicateTeamSkillError } from '#/domain/team/error/duplicate-team-skill.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import { TeamSkillNotFoundError } from '#/domain/team/error/team-skill-not-found.error.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { TeamSkillProficienciesRepository } from '#/infrastructure/persistence/team/team-skill-proficiencies.repository.js'

import { SkillProficiencyBuilder } from '../../builder/skill-proficiency.builder.js'
import { UNKNOWN_SKILL_ID, UNKNOWN_TEAM_ID } from '../../util/entity-ids.js'
import { by } from '../../util/sort-by-id.js'
import { skills, teamSkillProficiencies, teams } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

const bySkillId = by('skill_id')

describe('TeamSkillProficienciesRepository', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication
  let repository: TeamSkillProficienciesRepository
  let db: Database

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: TeamSkillProficienciesRepository.name,
        providers: [TeamSkillProficienciesRepository],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    repository = app.get(TeamSkillProficienciesRepository)
    db = app.get(IConnectionProvider).database
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return the skill proficiencies for a team', async () => {
      const result = await repository.get(teams.traffic.id)

      expect(result._unsafeUnwrap()).toEqual(teamSkillProficiencies.traffic)
    })

    it('should return an empty collection for a team with no skills', async () => {
      const result = await repository.get(teams.testing.id)

      expect(result._unsafeUnwrap()).toEqual(teamSkillProficiencies.testing)
    })

    it('should return TeamNotFoundError when the team does not exist', async () => {
      const result = await repository.get(UNKNOWN_TEAM_ID)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none(
        'ALTER VIEW view_team_skill_proficiencies RENAME TO view_team_skill_proficiencies_renamed',
      )

      await expect(repository.get(teams.traffic.id)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('add', () => {
    it('should add a skill proficiency', async () => {
      const created = SkillProficiencyBuilder.create({
        skillId: skills.qualityAssurance.id,
        proficiency: 2,
      })

      const result = await repository.add(teams.traffic.id, created)

      expect(result._unsafeUnwrap()).toBeUndefined()

      await expect(
        db.manyOrNone(
          'SELECT skill_id, proficiency FROM skills_to_teams WHERE team_id=$(teamId) ORDER BY skill_id',
          {
            teamId: teams.traffic.id,
          },
        ),
      ).resolves.toEqual(
        [
          {
            skill_id: skills.backendDevelopment.id,
            proficiency: 2,
          },
          {
            skill_id: skills.frontendDevelopment.id,
            proficiency: 3,
          },
          {
            skill_id: created.skillId,
            proficiency: created.proficiency,
          },
          {
            skill_id: skills.softwareArchitecture.id,
            proficiency: 2,
          },
        ].sort(bySkillId),
      )
    })

    it('should return DuplicateTeamSkillError when the skill is already associated', async () => {
      const duplicate = SkillProficiencyBuilder.create({
        skillId: skills.backendDevelopment.id,
        proficiency: 1,
      })

      const result = await repository.add(teams.traffic.id, duplicate)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateTeamSkillError)
    })

    it('should return SkillReferenceNotFoundError when the skill does not exist', async () => {
      const proficiency = SkillProficiencyBuilder.create({
        skillId: UNKNOWN_SKILL_ID,
        proficiency: 1,
      })

      const result = await repository.add(teams.traffic.id, proficiency)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(SkillReferenceNotFoundError)
    })

    it('should return TeamReferenceNotFoundError when the team does not exist', async () => {
      const proficiency = SkillProficiencyBuilder.create({
        skillId: skills.qualityAssurance.id,
        proficiency: 1,
      })

      const result = await repository.add(UNKNOWN_TEAM_ID, proficiency)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamReferenceNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const proficiency = SkillProficiencyBuilder.create({
        skillId: skills.qualityAssurance.id,
        proficiency: 2,
      })

      await db.none('ALTER TABLE skills_to_teams RENAME TO skills_to_teams_renamed')

      await expect(repository.add(teams.traffic.id, proficiency)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('update', () => {
    it('should update the proficiency level', async () => {
      const updated = SkillProficiencyBuilder.create({
        skillId: skills.backendDevelopment.id,
        proficiency: 4,
      })

      const result = await repository.update(teams.traffic.id, updated)

      expect(result._unsafeUnwrap()).toBeUndefined()

      await expect(
        db.oneOrNone(
          'SELECT * FROM skills_to_teams WHERE team_id=$(teamId) AND skill_id=$(skillId)',
          { teamId: teams.traffic.id, skillId: skills.backendDevelopment.id },
        ),
      ).resolves.toMatchObject({
        proficiency: 4,
      })
    })

    it('should return TeamSkillNotFoundError when the association does not exist', async () => {
      const proficiency = SkillProficiencyBuilder.create({
        skillId: skills.qualityAssurance.id,
        proficiency: 1,
      })

      const result = await repository.update(teams.traffic.id, proficiency)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamSkillNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const updated = SkillProficiencyBuilder.create({
        skillId: skills.backendDevelopment.id,
        proficiency: 4,
      })

      await db.none('ALTER TABLE skills_to_teams RENAME TO skills_to_teams_renamed')

      await expect(repository.update(teams.traffic.id, updated)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('remove', () => {
    it('should remove the skill association', async () => {
      const result = await repository.remove(teams.traffic.id, skills.backendDevelopment.id)

      expect(result._unsafeUnwrap()).toBeUndefined()

      await expect(
        db.manyOrNone(
          'SELECT skill_id, proficiency FROM skills_to_teams WHERE team_id=$(teamId) ORDER BY skill_id',
          {
            teamId: teams.traffic.id,
          },
        ),
      ).resolves.toEqual(
        [
          {
            skill_id: skills.frontendDevelopment.id,
            proficiency: 3,
          },
          {
            skill_id: skills.softwareArchitecture.id,
            proficiency: 2,
          },
        ].sort(bySkillId),
      )
    })

    it('should return TeamSkillNotFoundError when the association does not exist', async () => {
      const result = await repository.remove(teams.traffic.id, skills.qualityAssurance.id)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamSkillNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE skills_to_teams RENAME TO skills_to_teams_renamed')

      await expect(
        repository.remove(teams.traffic.id, skills.backendDevelopment.id),
      ).rejects.toThrow(UnexpectedPersistenceError)
    })
  })
})
