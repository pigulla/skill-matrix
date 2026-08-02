import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import type { TeamID } from '#/domain/team/team-id.js'
import { DuplicateUserEmailError } from '#/domain/user/error/duplicate-user-email.error.js'
import { DuplicateUserIdError } from '#/domain/user/error/duplicate-user-id.error.js'
import { UserNotFoundError } from '#/domain/user/error/user-not-found.error.js'
import type { User } from '#/domain/user/user.js'
import { IUserRepository } from '#/domain/user/user.repository.interface.js'
import type { UserID } from '#/domain/user/user-id.js'

import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { QUERY } from './sql/queries.js'
import { usersRow } from './sql/users.row.js'

const { ASSIGN_TEAM, DELETE, GET, GET_ALL, INSERT, UPDATE } = QUERY

@Injectable()
export class UserRepository implements IUserRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>

  public constructor(txHost: TransactionHost<TransactionalAdapterPgPromise>) {
    this.txHost = txHost
  }

  public async get(id: UserID): Promise<User> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(GET, { id })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new UserNotFoundError(id)
    }

    return usersRow.parse(row).toDomain()
  }

  public async getAll(): Promise<User[]> {
    let rows: unknown[]
    try {
      rows = await this.txHost.tx.manyOrNone<unknown>(GET_ALL)
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    return rows.map(row => usersRow.parse(row).toDomain())
  }

  public async update({ id, firstName, lastName, email }: User): Promise<User> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(UPDATE, {
        id,
        first_name: firstName,
        last_name: lastName,
        email,
      })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new UserNotFoundError(id)
    }

    return usersRow.parse(row).toDomain()
  }

  public async create({ id, firstName, lastName, email, teamId }: User): Promise<User> {
    let row: unknown

    try {
      row = await this.txHost.tx.one<unknown>(INSERT, {
        id,
        first_name: firstName,
        last_name: lastName,
        email,
        team_id: teamId,
      })
    } catch (error) {
      if (isUniqueConstraintViolation('users_pkey', error)) {
        throw new DuplicateUserIdError(id)
      }
      if (isUniqueConstraintViolation('users_email', error)) {
        throw new DuplicateUserEmailError(email)
      }
      if (isForeignKeyViolation('users_team_fkey', error)) {
        throw new TeamReferenceNotFoundError(teamId)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    return usersRow.parse(row).toDomain()
  }

  public async assignTeam(userId: UserID, teamId: TeamID): Promise<User> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(ASSIGN_TEAM, {
        id: userId,
        team_id: teamId,
      })
    } catch (error) {
      if (isForeignKeyViolation('users_team_fkey', error)) {
        throw new TeamReferenceNotFoundError(teamId)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new UserNotFoundError(userId)
    }

    return usersRow.parse(row).toDomain()
  }

  public async delete(id: UserID): Promise<void> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(DELETE, { id })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new UserNotFoundError(id)
    }
  }
}
