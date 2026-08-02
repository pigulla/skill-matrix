import type { INestApplication } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import { asProficiency } from '#/domain/skill/proficiency.js'
import { Skill } from '#/domain/skill/skill.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { SkillProficiency } from '#/domain/skill/skill-proficiency.js'
import { DuplicateTeamSkillError } from '#/domain/team/error/duplicate-team-skill.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import { TeamSkillNotFoundError } from '#/domain/team/error/team-skill-not-found.error.js'
import { Team } from '#/domain/team/team.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { TeamSkillProficienciesRepository } from '#/infrastructure/persistence/team/team-skill-proficiencies.repository.js'

import {
  ASSOCIATION_ASSERTION_HELPER,
  type AssociationHelper,
} from '../fixture/association-assertion-helper.js'
import { skills, teamSkillProficiencies, teams } from '../fixture/fixture.js'
import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

describe('TeamSkillProficienciesRepository', () => {
  const invalidTeamId = asTeamID('00000000-0002-4000-8000-000000000000')
  const invalidSkillId = asSkillID('00000000-0003-4000-8000-000000000000')
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication
  let repository: TeamSkillProficienciesRepository
  let association: AssociationHelper

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
    association = app.get(ASSOCIATION_ASSERTION_HELPER)
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return the skill proficiencies for a team', async () => {
      await expect(repository.get(teams.platform.id)).resolves.toEqual(
        teamSkillProficiencies.platform,
      )
    })

    it('should return an empty collection for a team with no skills', async () => {
      await expect(repository.get(teams.qa.id)).resolves.toEqual(teamSkillProficiencies.qa)
    })

    it('should throw TeamNotFoundError when the team does not exist', async () => {
      await expect(repository.get(invalidTeamId)).rejects.toThrow(TeamNotFoundError)
    })
  })

  describe('add', () => {
    it('should add a skill proficiency', async () => {
      const newProficiency = new SkillProficiency({
        skillId: skills.frontendDevelopment.id,
        proficiency: asProficiency(2),
      })

      await expect(repository.add(teams.platform.id, newProficiency)).resolves.toBeUndefined()

      await association
        .from(Team)
        .withId(teams.platform.id)
        .to(Skill)
        .withId(skills.frontendDevelopment.id)
        .andColumns('proficiency')
        .withData({ [skills.frontendDevelopment.id]: { proficiency: 2 } })
        .should.exist()
    })

    it('should throw DuplicateTeamSkillError when the skill is already associated', async () => {
      const duplicate = new SkillProficiency({
        skillId: skills.backendDevelopment.id,
        proficiency: asProficiency(1),
      })

      await expect(repository.add(teams.platform.id, duplicate)).rejects.toThrow(
        DuplicateTeamSkillError,
      )
    })

    it('should throw SkillReferenceNotFoundError when the skill does not exist', async () => {
      const proficiency = new SkillProficiency({
        skillId: invalidSkillId,
        proficiency: asProficiency(1),
      })

      await expect(repository.add(teams.platform.id, proficiency)).rejects.toThrow(
        SkillReferenceNotFoundError,
      )
    })

    it('should throw TeamReferenceNotFoundError when the team does not exist', async () => {
      const proficiency = new SkillProficiency({
        skillId: skills.frontendDevelopment.id,
        proficiency: asProficiency(1),
      })

      await expect(repository.add(invalidTeamId, proficiency)).rejects.toThrow(
        TeamReferenceNotFoundError,
      )
    })
  })

  describe('update', () => {
    it('should update the proficiency level', async () => {
      const updated = new SkillProficiency({
        skillId: skills.backendDevelopment.id,
        proficiency: asProficiency(4),
      })

      await expect(repository.update(teams.platform.id, updated)).resolves.toBeUndefined()

      await association
        .from(Team)
        .withId(teams.platform.id)
        .to(Skill)
        .withId(skills.backendDevelopment.id)
        .andColumns('proficiency')
        .withData({ [skills.backendDevelopment.id]: { proficiency: 4 } })
        .should.exist()
    })

    it('should throw TeamSkillNotFoundError when the association does not exist', async () => {
      const proficiency = new SkillProficiency({
        skillId: skills.frontendDevelopment.id,
        proficiency: asProficiency(1),
      })

      await expect(repository.update(teams.platform.id, proficiency)).rejects.toThrow(
        TeamSkillNotFoundError,
      )
    })
  })

  describe('remove', () => {
    it('should remove the skill association', async () => {
      await expect(
        repository.remove(teams.platform.id, skills.backendDevelopment.id),
      ).resolves.toBeUndefined()

      await association
        .from(Team)
        .withId(teams.platform.id)
        .to(Skill)
        .withId(skills.backendDevelopment.id)
        .should.not.exist()
    })

    it('should throw TeamSkillNotFoundError when the association does not exist', async () => {
      await expect(
        repository.remove(teams.platform.id, skills.frontendDevelopment.id),
      ).rejects.toThrow(TeamSkillNotFoundError)
    })
  })
})
