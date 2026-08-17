import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { err, ok } from 'neverthrow'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import { DuplicateTeamSkillProficienciesError } from '#/domain/team/skill-proficiencies/error/duplicate-team-skill-proficiencies.error.js'
import { TeamSkillProficienciesNotFoundError } from '#/domain/team/skill-proficiencies/error/team-skill-proficiencies-not-found.error.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { TeamSkillProficienciesRepository } from '#/infrastructure/persistence/team/skill-proficiencies/team-skill-proficiencies.repository.js'

import { SkillProficiencyBuilder } from '../../builder/skill-proficiency.builder.js'
import { UNKNOWN_SKILL_ID, UNKNOWN_TEAM_ID } from '../../util/entity-ids.js'
import { skills, teamSkillProficiencies, teams } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

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

      expect(result).toEqual(ok(teamSkillProficiencies.traffic))
    })

    it('should return an empty collection for a team with no skills', async () => {
      const result = await repository.get(teams.testing.id)

      expect(result).toEqual(ok(teamSkillProficiencies.testing))
    })

    it('should return TeamNotFoundError if the team does not exist', async () => {
      const result = await repository.get(UNKNOWN_TEAM_ID)

      expect(result).toEqual(err(new TeamNotFoundError(UNKNOWN_TEAM_ID)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
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

      expect(result).toEqual(ok(undefined))

      await expect(
        db.manyOrNone(
          'SELECT skill_id, proficiency FROM skills_to_teams_with_proficiency WHERE team_id=$(teamId) ORDER BY skill_id',
          {
            teamId: teams.traffic.id,
          },
        ),
      ).resolves.to.have.deep.members([
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
      ])
    })

    it('should return DuplicateTeamSkillProficienciesError if the skill is already associated', async () => {
      const duplicate = SkillProficiencyBuilder.create({
        skillId: skills.backendDevelopment.id,
        proficiency: 1,
      })

      const result = await repository.add(teams.traffic.id, duplicate)

      expect(result).toEqual(
        err(
          new DuplicateTeamSkillProficienciesError({
            teamId: teams.traffic.id,
            skillId: skills.backendDevelopment.id,
          }),
        ),
      )
    })

    it('should return SkillReferenceNotFoundError if the skill does not exist', async () => {
      const proficiency = SkillProficiencyBuilder.create({
        skillId: UNKNOWN_SKILL_ID,
        proficiency: 1,
      })

      const result = await repository.add(teams.traffic.id, proficiency)

      expect(result).toEqual(err(new SkillReferenceNotFoundError(UNKNOWN_SKILL_ID)))
    })

    it('should return TeamReferenceNotFoundError if the team does not exist', async () => {
      const proficiency = SkillProficiencyBuilder.create({
        skillId: skills.qualityAssurance.id,
        proficiency: 1,
      })

      const result = await repository.add(UNKNOWN_TEAM_ID, proficiency)

      expect(result).toEqual(err(new TeamReferenceNotFoundError(UNKNOWN_TEAM_ID)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const proficiency = SkillProficiencyBuilder.create({
        skillId: skills.qualityAssurance.id,
        proficiency: 2,
      })

      await db.none(
        'ALTER TABLE skills_to_teams_with_proficiency RENAME TO skills_to_teams_renamed',
      )

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

      expect(result).toEqual(ok(undefined))

      await expect(
        db.oneOrNone(
          'SELECT * FROM skills_to_teams_with_proficiency WHERE team_id=$(teamId) AND skill_id=$(skillId)',
          { teamId: teams.traffic.id, skillId: skills.backendDevelopment.id },
        ),
      ).resolves.toMatchObject({
        proficiency: 4,
      })
    })

    it('should return TeamSkillProficienciesNotFoundError if the association does not exist', async () => {
      const proficiency = SkillProficiencyBuilder.create({
        skillId: skills.qualityAssurance.id,
        proficiency: 1,
      })

      const result = await repository.update(teams.traffic.id, proficiency)

      expect(result).toEqual(
        err(
          new TeamSkillProficienciesNotFoundError({
            teamId: teams.traffic.id,
            skillId: skills.qualityAssurance.id,
          }),
        ),
      )
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const updated = SkillProficiencyBuilder.create({
        skillId: skills.backendDevelopment.id,
        proficiency: 4,
      })

      await db.none(
        'ALTER TABLE skills_to_teams_with_proficiency RENAME TO skills_to_teams_renamed',
      )

      await expect(repository.update(teams.traffic.id, updated)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('remove', () => {
    it('should remove the skill association', async () => {
      const result = await repository.remove(teams.traffic.id, skills.backendDevelopment.id)

      expect(result).toEqual(ok(undefined))

      await expect(
        db.manyOrNone(
          'SELECT skill_id, proficiency FROM skills_to_teams_with_proficiency WHERE team_id=$(teamId) ORDER BY skill_id',
          {
            teamId: teams.traffic.id,
          },
        ),
      ).resolves.to.have.deep.members([
        {
          skill_id: skills.frontendDevelopment.id,
          proficiency: 3,
        },
        {
          skill_id: skills.softwareArchitecture.id,
          proficiency: 2,
        },
      ])
    })

    it('should return TeamSkillProficienciesNotFoundError if the association does not exist', async () => {
      const result = await repository.remove(teams.traffic.id, skills.qualityAssurance.id)

      expect(result).toEqual(
        err(
          new TeamSkillProficienciesNotFoundError({
            teamId: teams.traffic.id,
            skillId: skills.qualityAssurance.id,
          }),
        ),
      )
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      await db.none(
        'ALTER TABLE skills_to_teams_with_proficiency RENAME TO skills_to_teams_renamed',
      )

      await expect(
        repository.remove(teams.traffic.id, skills.backendDevelopment.id),
      ).rejects.toThrow(UnexpectedPersistenceError)
    })
  })
})
