import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import dayjs from 'dayjs'
import { err, type Ok, ok } from 'neverthrow'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ITimeProvider } from '#/application/time-provider.interface.js'
import { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import { TeamConcurrencyError } from '#/domain/team/error/team-concurrency.error.js'
import { TeamInUseError } from '#/domain/team/error/team-in-use.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { TeamRepository } from '#/infrastructure/persistence/team/team.repository.js'
import { mockTimeProvider, type TimeProviderMock } from '#/mocks.js'

import { TeamBuilder } from '../../builder/team.builder.js'
import { STALE_CONCURRENCY_TOKEN } from '../../util/concurrency-tokens.js'
import { UNKNOWN_TEAM_ID } from '../../util/entity-ids.js'
import { teams, users } from '../fixture/fixture.js'
import { type ETags, getETags } from '../fixture/get-etags.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('TeamRepository', () => {
  const integrationTest = setupIntegrationTest()
  const now = dayjs('2026-01-01T00:00:00.000Z')

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

      expect(result).toEqual(
        ok({
          value: teams.traffic,
          token: etags.teams[teams.traffic.id].token,
        }),
      )
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

      expect(result.isOk()).toBe(true)
      expect((result as Ok<unknown, unknown>).value).to.have.deep.members(Object.values(teams))
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
      const token = (await getETags(db)).teams[team.id].token

      expect(result).toEqual(
        ok({
          value: team,
          token,
        }),
      )

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
      const token = (await getETags(db)).teams[updated.id].token

      expect(result).toEqual(
        ok({
          value: updated,
          token,
        }),
      )

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

      const result = await teamRepository.update(team, STALE_CONCURRENCY_TOKEN)

      expect(result).toEqual(err(new TeamNotFoundError(UNKNOWN_TEAM_ID)))
    })

    it('should return DuplicateTeamNameError if the name already exists', async () => {
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

    it('should give two updates that land in the same instant distinct tokens, so a stale token is rejected', async () => {
      // The time provider is never advanced in this test, so both updates below genuinely share one
      // `last_updated` instant. Under the old timestamp-derived token, that made the token minted by
      // the first update indistinguishable from the token minted by the second - a stale `If-Match`
      // could still match. With a monotonic `version`, the two tokens must differ regardless of timing.
      const initialToken = etags.teams[teams.traffic.id].token
      const firstUpdate = TeamBuilder.from(teams.traffic).withName('Infrastructure').build()
      const secondUpdate = TeamBuilder.from(teams.traffic).withName('Platform').build()

      const firstResult = await teamRepository.update(firstUpdate, initialToken)
      const firstToken = (await getETags(db)).teams[teams.traffic.id].token

      expect(firstResult).toEqual(ok({ value: firstUpdate, token: firstToken }))

      const secondResult = await teamRepository.update(secondUpdate, firstToken)
      const secondToken = (await getETags(db)).teams[teams.traffic.id].token

      expect(secondResult).toEqual(ok({ value: secondUpdate, token: secondToken }))
      expect(secondToken).not.toEqual(firstToken)

      // Replaying the first update with the token it originally minted - now stale, because the second
      // update has since moved the row on - must be rejected.
      const replayResult = await teamRepository.update(firstUpdate, firstToken)

      expect(replayResult).toEqual(err(new TeamConcurrencyError(teams.traffic.id)))
    })
  })

  describe('delete', () => {
    it('should delete a team', async () => {
      const currentToken = etags.teams[teams.testing.id].token

      const result = await teamRepository.delete(teams.testing.id, currentToken)

      expect(result).toEqual(ok(undefined))

      await expect(
        db.oneOrNone('SELECT name FROM teams WHERE id=$(id)', { id: teams.testing.id }),
      ).resolves.toBeNull()
    })

    it('should return TeamConcurrencyError if the token does not match', async () => {
      const result = await teamRepository.delete(teams.testing.id, STALE_CONCURRENCY_TOKEN)

      expect(result).toEqual(err(new TeamConcurrencyError(teams.testing.id)))
    })

    it('should return TeamNotFoundError if the team does not exist', async () => {
      const result = await teamRepository.delete(UNKNOWN_TEAM_ID, STALE_CONCURRENCY_TOKEN)

      expect(result).toEqual(err(new TeamNotFoundError(UNKNOWN_TEAM_ID)))
    })

    it('should return TeamInUseError if the team still has members', async () => {
      const currentToken = etags.teams[users.peter.teamId].token

      const result = await teamRepository.delete(users.peter.teamId, currentToken)

      expect(result).toEqual(err(new TeamInUseError(users.peter.teamId)))
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
