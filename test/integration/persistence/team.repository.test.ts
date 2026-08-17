import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import dayjs from 'dayjs'
import { err } from 'neverthrow'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ITimeProvider } from '#/application/time-provider.interface.js'
import { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import { TeamConcurrencyError } from '#/domain/team/error/team-concurrency.error.js'
import { TeamNotEmptyError } from '#/domain/team/error/team-not-empty.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { toConcurrencyToken } from '#/infrastructure/persistence/concurrency-token.codec.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { TeamRepository } from '#/infrastructure/persistence/team/team.repository.js'
import { mockTimeProvider, type TimeProviderMock } from '#/mocks.js'

import { TeamBuilder } from '../../builder/team.builder.js'
import { STALE_CONCURRENCY_TOKEN } from '../../util/concurrency-tokens.js'
import { UNKNOWN_TEAM_ID } from '../../util/entity-ids.js'
import { teams, users } from '../fixture/fixture.js'
import { type ETags, getETags } from '../fixture/get-etags.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

const now = dayjs('2026-01-01T00:00:00.000Z')

describe('TeamRepository', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication
  let teamRepository: TeamRepository
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
        testName: TeamRepository.name,
        providers: [TeamRepository, { provide: ITimeProvider, useValue: timeProviderMock }],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    teamRepository = app.get(TeamRepository)
    db = app.get(IConnectionProvider).database
    etags = await getETags(db)
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return the team and its token', async () => {
      const result = await teamRepository.get(teams.traffic.id)

      expect(result._unsafeUnwrap()).toEqual({
        value: teams.traffic,
        token: etags.teams[teams.traffic.id].token,
      })
    })

    it('should return TeamNotFoundError if the team does not exist', async () => {
      const result = await teamRepository.get(UNKNOWN_TEAM_ID)

      expect(result).toEqual(err(new TeamNotFoundError(UNKNOWN_TEAM_ID)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      await db.none('ALTER TABLE teams RENAME TO teams_renamed')

      await expect(teamRepository.get(teams.traffic.id)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('getAll', () => {
    it('should return all teams', async () => {
      const result = await teamRepository.getAll()

      expect(result._unsafeUnwrap()).to.have.deep.members(Object.values(teams))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
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

      expect(result._unsafeUnwrap()).toEqual({ value: team, token: toConcurrencyToken(now) })

      await expect(
        db.oneOrNone('SELECT * FROM teams WHERE id=$(id)', { id: team.id }),
      ).resolves.toMatchObject({
        name: team.name,
        last_updated: now,
      })
    })

    it('should return DuplicateTeamIdError if the id already exists', async () => {
      const team = TeamBuilder.from(teams.traffic).withName('Different').build()

      const result = await teamRepository.create(team)

      expect(result).toEqual(err(new DuplicateTeamIdError(teams.traffic.id)))
    })

    it('should return DuplicateTeamNameError if the name already exists', async () => {
      const team = TeamBuilder.create({
        name: teams.traffic.name,
      })

      const result = await teamRepository.create(team)

      expect(result).toEqual(err(new DuplicateTeamNameError(teams.traffic.name)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const team = TeamBuilder.create({
        name: 'Design',
      })

      await db.none('ALTER TABLE teams RENAME TO teams_renamed')

      await expect(teamRepository.create(team)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('update', () => {
    it('should update a team', async () => {
      const later = now.add(5, 'minutes')
      const updated = TeamBuilder.from(teams.traffic).withName('Infrastructure').build()

      timeProviderMock.now.mockReturnValue(later)

      const result = await teamRepository.update(updated, etags.teams[teams.traffic.id].token)

      expect(result._unsafeUnwrap()).toEqual({ value: updated, token: toConcurrencyToken(later) })

      await expect(
        db.oneOrNone('SELECT * FROM teams WHERE id=$(id)', { id: updated.id }),
      ).resolves.toMatchObject({
        name: updated.name,
        last_updated: later,
      })
    })

    it('should return TeamConcurrencyError if the token does not match', async () => {
      const updated = TeamBuilder.from(teams.traffic).withName('Infrastructure').build()

      const result = await teamRepository.update(updated, STALE_CONCURRENCY_TOKEN)

      expect(result).toEqual(err(new TeamConcurrencyError(teams.traffic.id)))
    })

    it('should return TeamNotFoundError if the team does not exist', async () => {
      const team = new TeamBuilder().withId(UNKNOWN_TEAM_ID).build()

      const result = await teamRepository.update(team, toConcurrencyToken(now))

      expect(result).toEqual(err(new TeamNotFoundError(UNKNOWN_TEAM_ID)))
    })

    it('should return DuplicateTeamNameError if the name is taken', async () => {
      const currentToken = etags.teams[teams.traffic.id].token
      const updated = TeamBuilder.from(teams.traffic).withName(teams.testing.name).build()

      const result = await teamRepository.update(updated, currentToken)

      expect(result).toEqual(err(new DuplicateTeamNameError(teams.testing.name)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const currentToken = etags.teams[teams.traffic.id].token
      const updated = TeamBuilder.from(teams.traffic).withName('Infrastructure').build()

      await db.none('ALTER TABLE teams RENAME TO teams_renamed')

      await expect(teamRepository.update(updated, currentToken)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('delete', () => {
    it('should delete a team', async () => {
      const currentToken = etags.teams[teams.testing.id].token

      const result = await teamRepository.delete(teams.testing.id, currentToken)

      expect(result.isOk()).toBe(true)

      await expect(
        db.oneOrNone('SELECT name FROM teams WHERE id=$(id)', { id: teams.testing.id }),
      ).resolves.toBeNull()
    })

    it('should return TeamConcurrencyError if the token does not match', async () => {
      const result = await teamRepository.delete(teams.testing.id, STALE_CONCURRENCY_TOKEN)

      expect(result).toEqual(err(new TeamConcurrencyError(teams.testing.id)))
    })

    it('should return TeamNotFoundError if the team does not exist', async () => {
      const result = await teamRepository.delete(UNKNOWN_TEAM_ID, toConcurrencyToken(now))

      expect(result).toEqual(err(new TeamNotFoundError(UNKNOWN_TEAM_ID)))
    })

    it('should return TeamNotEmptyError if the team still has members', async () => {
      const currentToken = etags.teams[users.peter.teamId].token

      const result = await teamRepository.delete(users.peter.teamId, currentToken)

      expect(result).toEqual(err(new TeamNotEmptyError(users.peter.teamId)))
    })

    it('should throw UnexpectedPersistenceError if the query fails', async () => {
      const currentToken = etags.teams[teams.testing.id].token

      await db.none('ALTER TABLE teams RENAME TO teams_renamed')

      await expect(teamRepository.delete(teams.testing.id, currentToken)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })
})
