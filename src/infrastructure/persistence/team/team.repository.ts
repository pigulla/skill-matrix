import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import { TeamNotEmptyError } from '#/domain/team/error/team-not-empty.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import type { Team } from '#/domain/team/team.js'
import { ITeamRepository } from '#/domain/team/team.repository.interface.js'
import type { TeamID } from '#/domain/team/team-id.js'

import { isRestrictViolation } from '../error/is-restrict-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { QUERY } from './sql/queries.js'
import { teamsRow } from './sql/teams.row.js'

const { DELETE, GET, GET_ALL, INSERT, UPDATE } = QUERY

@Injectable()
export class TeamRepository implements ITeamRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>

  public constructor(txHost: TransactionHost<TransactionalAdapterPgPromise>) {
    this.txHost = txHost
  }

  public get(id: TeamID): ResultAsync<Team, TeamNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row =>
      row === null ? errAsync(new TeamNotFoundError(id)) : okAsync(teamsRow.parse(row).toDomain()),
    )
  }

  public getAll(): ResultAsync<Team[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => teamsRow.parse(row).toDomain()))
  }

  public create({
    id,
    name,
  }: Team): ResultAsync<Team, DuplicateTeamIdError | DuplicateTeamNameError> {
    return ResultAsync.fromPromise(this.txHost.tx.one<unknown>(INSERT, { id, name }), error => {
      if (isUniqueConstraintViolation('teams_pkey', error)) {
        return new DuplicateTeamIdError(id)
      }
      if (isUniqueConstraintViolation('teams_name', error)) {
        return new DuplicateTeamNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }).map(row => teamsRow.parse(row).toDomain())
  }

  public update({ id, name }: Team): ResultAsync<Team, TeamNotFoundError | DuplicateTeamNameError> {
    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(UPDATE, { id, name }),
      error => {
        if (isUniqueConstraintViolation('teams_name', error)) {
          return new DuplicateTeamNameError(name)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row =>
      row === null ? errAsync(new TeamNotFoundError(id)) : okAsync(teamsRow.parse(row).toDomain()),
    )
  }

  public delete(id: TeamID): ResultAsync<void, TeamNotFoundError | TeamNotEmptyError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(DELETE, { id }), error => {
      if (isRestrictViolation('users_team_fkey', error)) {
        return new TeamNotEmptyError(id)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row => (row === null ? errAsync(new TeamNotFoundError(id)) : okAsync(undefined)))
  }
}
