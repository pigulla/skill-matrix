import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import { TeamNotEmptyError } from '#/domain/team/error/team-not-empty.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { TeamRepository } from '#/infrastructure/persistence/team/team.repository.js'

import { TeamBuilder } from '../../builder/team.builder.js'
import { teams, users } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('TeamRepository', () => {
  const invalidId = asTeamID('00000000-0002-4000-8000-000000000000')
  const integrationTest = setupIntegrationTest()

  let app: INestApplication
  let teamRepository: TeamRepository
  let db: Database

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
    db = app.get(IConnectionProvider).database
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return a team', async () => {
      const result = await teamRepository.get(teams.traffic.id)

      expect(result._unsafeUnwrap()).toEqual(teams.traffic)
    })

    it('should return TeamNotFoundError', async () => {
      const result = await teamRepository.get(invalidId)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE teams RENAME TO teams_renamed')

      await expect(teamRepository.get(teams.traffic.id)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('getAll', () => {
    it('should return all teams', async () => {
      const result = await teamRepository.getAll()

      expect(result._unsafeUnwrap()).to.have.deep.members(Object.values(teams))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE teams RENAME TO teams_renamed')

      await expect(teamRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('create', () => {
    it('should create a team', async () => {
      const team = TeamBuilder.create({
        name: 'Design',
      })

      const result = await teamRepository.create(team)

      expect(result._unsafeUnwrap()).toEqual(team)

      await expect(
        db.oneOrNone('SELECT * FROM teams WHERE id=$(id)', { id: team.id }),
      ).resolves.toMatchObject({
        name: team.name,
      })
    })

    it('should return DuplicateTeamIdError if the id already exists', async () => {
      const team = TeamBuilder.from(teams.traffic).withName('Different').build()

      const result = await teamRepository.create(team)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateTeamIdError)
    })

    it('should return DuplicateTeamNameError if the name already exists', async () => {
      const team = TeamBuilder.create({
        name: teams.traffic.name,
      })

      const result = await teamRepository.create(team)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateTeamNameError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const team = TeamBuilder.create({
        name: 'Design',
      })

      await db.none('ALTER TABLE teams RENAME TO teams_renamed')

      await expect(teamRepository.create(team)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('update', () => {
    it('should update a team', async () => {
      const updated = TeamBuilder.from(teams.traffic).withName('Infrastructure').build()

      const result = await teamRepository.update(updated)

      expect(result._unsafeUnwrap()).toEqual(updated)

      await expect(
        db.oneOrNone('SELECT * FROM teams WHERE id=$(id)', { id: updated.id }),
      ).resolves.toMatchObject({
        name: updated.name,
      })
    })

    it('should return TeamNotFoundError if the team does not exist', async () => {
      const team = new TeamBuilder().withId(invalidId).build()

      const result = await teamRepository.update(team)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamNotFoundError)
    })

    it('should return DuplicateTeamNameError if the name is taken', async () => {
      const updated = TeamBuilder.from(teams.traffic).withName(teams.testing.name).build()

      const result = await teamRepository.update(updated)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateTeamNameError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const updated = TeamBuilder.from(teams.traffic).withName('Infrastructure').build()

      await db.none('ALTER TABLE teams RENAME TO teams_renamed')

      await expect(teamRepository.update(updated)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('delete', () => {
    it('should delete a team', async () => {
      const result = await teamRepository.delete(teams.testing.id)

      expect(result._unsafeUnwrap()).toBeUndefined()

      await expect(
        db.oneOrNone('SELECT name FROM teams WHERE id=$(id)', { id: teams.testing.id }),
      ).resolves.toBeNull()
    })

    it('should return TeamNotFoundError if the team does not exist', async () => {
      const result = await teamRepository.delete(invalidId)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamNotFoundError)
    })

    it('should return TeamNotEmptyError when the team still has members', async () => {
      const result = await teamRepository.delete(users.peter.teamId)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamNotEmptyError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE teams RENAME TO teams_renamed')

      await expect(teamRepository.delete(teams.testing.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })
})
