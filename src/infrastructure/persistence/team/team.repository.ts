import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'

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

  public async get(id: TeamID): Promise<Team> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(GET, { id })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new TeamNotFoundError(id)
    }

    return teamsRow.parse(row).toDomain()
  }

  public async getAll(): Promise<Team[]> {
    let rows: unknown[]

    try {
      rows = await this.txHost.tx.manyOrNone<unknown>(GET_ALL)
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    return rows.map(row => teamsRow.parse(row).toDomain())
  }

  public async create({ id, name }: Team): Promise<Team> {
    let row: unknown

    try {
      row = await this.txHost.tx.one<unknown>(INSERT, { id, name })
    } catch (error) {
      if (isUniqueConstraintViolation('teams_pkey', error)) {
        throw new DuplicateTeamIdError(id)
      }
      if (isUniqueConstraintViolation('teams_name', error)) {
        throw new DuplicateTeamNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    return teamsRow.parse(row).toDomain()
  }

  public async update({ id, name }: Team): Promise<Team> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(UPDATE, { id, name })
    } catch (error) {
      if (isUniqueConstraintViolation('teams_name', error)) {
        throw new DuplicateTeamNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new TeamNotFoundError(id)
    }

    return teamsRow.parse(row).toDomain()
  }

  public async delete(id: TeamID): Promise<void> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(DELETE, { id })
    } catch (error) {
      if (isRestrictViolation('users_team_fkey', error)) {
        throw new TeamNotEmptyError(id)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new TeamNotFoundError(id)
    }
  }
}
