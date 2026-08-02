import type { INestApplication } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import { TeamNotEmptyError } from '#/domain/team/error/team-not-empty.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { Team } from '#/domain/team/team.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { TeamRepository } from '#/infrastructure/persistence/team/team.repository.js'

import { TeamBuilder } from '../../builder/team.builder.js'
import {
  ENTITY_ASSERTION_HELPER,
  type EntityAssertionHelper,
} from '../fixture/entity-assertion-helper.js'
import { teams, users } from '../fixture/fixture.js'
import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

describe('TeamRepository', () => {
  const invalidId = asTeamID('00000000-0002-4000-8000-000000000000')
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication
  let teamRepository: TeamRepository
  let entity: EntityAssertionHelper

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: TeamRepository.name,
        providers: [TeamRepository],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    teamRepository = app.get(TeamRepository)
    entity = app.get(ENTITY_ASSERTION_HELPER)
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return a team', async () => {
      await expect(teamRepository.get(teams.platform.id)).resolves.toEqual(teams.platform)
    })

    it('should throw', async () => {
      await expect(teamRepository.get(invalidId)).rejects.toThrow(TeamNotFoundError)
    })
  })

  describe('getAll', () => {
    it('should return all teams', async () => {
      await expect(teamRepository.getAll()).resolves.to.have.deep.members(Object.values(teams))
    })
  })

  describe('create', () => {
    it('should create a team', async () => {
      const team = TeamBuilder.create({
        id: '40000000-0002-4000-8000-0000000000aa',
        name: 'Design',
      })

      await expect(teamRepository.create(team)).resolves.toEqual(team)

      await entity(Team).withId(team.id).andColumns({ name: team.name }).should.exist()
    })

    it('should throw if the id already exists', async () => {
      const team = TeamBuilder.from(teams.platform).withName('Different').build()

      await expect(teamRepository.create(team)).rejects.toThrow(DuplicateTeamIdError)
    })

    it('should throw if the name already exists', async () => {
      const team = TeamBuilder.create({
        id: '40000000-0002-4000-8000-0000000000bb',
        name: teams.platform.name,
      })

      await expect(teamRepository.create(team)).rejects.toThrow(DuplicateTeamNameError)
      await entity(Team).withId('40000000-0002-4000-8000-0000000000bb').should.not.exist()
    })
  })

  describe('update', () => {
    it('should update a team', async () => {
      const updated = TeamBuilder.from(teams.platform).withName('Platform Engineering').build()

      await expect(teamRepository.update(updated)).resolves.toEqual(updated)
      await entity(Team).withId(updated.id).andColumns({ name: updated.name }).should.exist()
    })

    it('should throw if the team does not exist', async () => {
      const team = new TeamBuilder().withId(invalidId).build()

      await expect(() => teamRepository.update(team)).rejects.toThrow(TeamNotFoundError)
    })
  })

  describe('delete', () => {
    it('should delete a team', async () => {
      await expect(teamRepository.delete(teams.qa.id)).resolves.toBeUndefined()

      await entity(Team).withId(teams.qa.id).should.not.exist()
    })

    it('should throw if the team does not exist', async () => {
      await expect(() => teamRepository.delete(invalidId)).rejects.toThrow(TeamNotFoundError)
    })

    it('should throw when the team still has members', async () => {
      await expect(() => teamRepository.delete(users.eddie.teamId)).rejects.toThrow(
        TeamNotEmptyError,
      )
      await entity(Team).withId(users.eddie.teamId).should.exist()
    })
  })
})
