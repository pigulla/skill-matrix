import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ITimeProvider } from '#/application/time-provider.interface.js'
import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import { TeamConcurrencyError } from '#/domain/team/error/team-concurrency.error.js'
import { TeamNotEmptyError } from '#/domain/team/error/team-not-empty.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { Team } from '#/domain/team/team.js'
import { ITeamRepository } from '#/domain/team/team.repository.interface.js'
import type { TeamID } from '#/domain/team/team-id.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'

import { toConcurrencyToken } from '../concurrency-token.codec.js'
import { isRestrictViolation } from '../error/is-restrict-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { QUERY } from './sql/queries.js'
import { teamsDeleteRow, teamsRow, teamsUpdateRow } from './sql/teams.row.js'

const { DELETE, GET, GET_ALL, INSERT, UPDATE } = QUERY

@Injectable()
export class TeamRepository implements ITeamRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>
  private readonly timeProvider: ITimeProvider

  public constructor(
    txHost: TransactionHost<TransactionalAdapterPgPromise>,
    timeProvider: ITimeProvider,
  ) {
    this.txHost = txHost
    this.timeProvider = timeProvider
  }

  public get(id: TeamID): ResultAsync<WithConcurrencyToken<Team>, TeamNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row => {
      if (row === null) {
        return errAsync(new TeamNotFoundError(id))
      }

      const parsed = teamsRow.parse(row)

      return okAsync({ value: parsed.toDomain(), token: parsed.getConcurrencyToken() })
    })
  }

  public getAll(): ResultAsync<Team[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => teamsRow.parse(row).toDomain()))
  }

  public create(
    team: Team,
  ): ResultAsync<WithConcurrencyToken<Team>, DuplicateTeamIdError | DuplicateTeamNameError> {
    const { id, name } = team
    const lastUpdated = this.timeProvider.now().toDate()

    return ResultAsync.fromPromise(
      this.txHost.tx.one<unknown>(INSERT, { id, name, lastUpdated }),
      error => {
        if (isUniqueConstraintViolation('teams_pkey', error)) {
          return new DuplicateTeamIdError(id)
        }
        if (isUniqueConstraintViolation('teams_name', error)) {
          return new DuplicateTeamNameError(name)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).map(row => {
      const parsed = teamsRow.parse(row)

      return { value: parsed.toDomain(), token: parsed.getConcurrencyToken() }
    })
  }

  public update(
    team: Team,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Team>,
    TeamNotFoundError | DuplicateTeamNameError | TeamConcurrencyError
  > {
    const { id, name } = team
    const lastUpdated = this.timeProvider.now().toDate()
    const self = this

    async function update(): Promise<WithConcurrencyToken<Team>> {
      // oneOrNone yields: null (no such team), all-null columns (stale token), or a populated row (updated).
      const row = await self.txHost.tx.oneOrNone<unknown>(UPDATE, {
        id,
        name,
        lastUpdated,
        expectedToken,
      })

      if (row === null) {
        throw new TeamNotFoundError(id)
      }

      const parsed = teamsUpdateRow.parse(row)

      if (parsed.id === null) {
        throw new TeamConcurrencyError(id)
      }

      return {
        value: new Team({ id: parsed.id, name: parsed.name }),
        token: toConcurrencyToken(parsed.last_updated),
      }
    }

    return ResultAsync.fromPromise(update(), error => {
      if (error instanceof TeamNotFoundError || error instanceof TeamConcurrencyError) {
        return error
      }
      if (isUniqueConstraintViolation('teams_name', error)) {
        return new DuplicateTeamNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    })
  }

  public delete(
    id: TeamID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<void, TeamNotFoundError | TeamNotEmptyError | TeamConcurrencyError> {
    // oneOrNone yields: null (no such team), { id: null } (stale token), or { id } (deleted).
    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(DELETE, { id, expectedToken }),
      error => {
        if (isRestrictViolation('users_team_fkey', error)) {
          return new TeamNotEmptyError(id)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row => {
      if (row === null) {
        return errAsync(new TeamNotFoundError(id))
      }

      return teamsDeleteRow.parse(row).id === null
        ? errAsync(new TeamConcurrencyError(id))
        : okAsync(undefined)
    })
  }
}
