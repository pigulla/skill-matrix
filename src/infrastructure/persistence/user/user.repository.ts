import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import { DuplicateUserEmailError } from '#/domain/user/error/duplicate-user-email.error.js'
import { DuplicateUserIdError } from '#/domain/user/error/duplicate-user-id.error.js'
import { UserNotFoundError } from '#/domain/user/error/user-not-found.error.js'
import type { User } from '#/domain/user/user.js'
import { IUserRepository } from '#/domain/user/user.repository.interface.js'
import type { UserID } from '#/domain/user/user-id.js'

import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { QUERY } from './sql/queries.js'
import { userRow } from './sql/user.row.js'

const { DELETE, GET, GET_ALL, INSERT, UPDATE } = QUERY

@Injectable()
export class UserRepository implements IUserRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>

  public constructor(txHost: TransactionHost<TransactionalAdapterPgPromise>) {
    this.txHost = txHost
  }

  public getAll(): ResultAsync<User[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => userRow.parse(row).toDomain()))
  }

  public get(id: UserID): ResultAsync<User, UserNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row =>
      row === null ? errAsync(new UserNotFoundError(id)) : okAsync(userRow.parse(row).toDomain()),
    )
  }

  public create(
    user: User,
  ): ResultAsync<
    User,
    DuplicateUserIdError | DuplicateUserEmailError | TeamReferenceNotFoundError
  > {
    const { id, firstName, lastName, email, teamId } = user

    return ResultAsync.fromPromise(
      this.txHost.tx.one<unknown>(INSERT, {
        id,
        first_name: firstName,
        last_name: lastName,
        email,
        team_id: teamId,
      }),
      error => {
        if (isUniqueConstraintViolation('users_pkey', error)) {
          return new DuplicateUserIdError(id)
        }
        if (isUniqueConstraintViolation('users_email', error)) {
          return new DuplicateUserEmailError(email)
        }
        if (isForeignKeyViolation('users_team_fkey', error)) {
          return new TeamReferenceNotFoundError(teamId)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).map(row => userRow.parse(row).toDomain())
  }

  public update(
    user: User,
  ): ResultAsync<User, UserNotFoundError | DuplicateUserEmailError | TeamReferenceNotFoundError> {
    const { id, firstName, lastName, email, teamId } = user

    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(UPDATE, {
        id,
        first_name: firstName,
        last_name: lastName,
        email,
        team_id: teamId,
      }),
      error => {
        if (isForeignKeyViolation('users_team_fkey', error)) {
          return new TeamReferenceNotFoundError(teamId)
        }
        if (isUniqueConstraintViolation('users_email', error)) {
          return new DuplicateUserEmailError(email)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row =>
      row === null ? errAsync(new UserNotFoundError(id)) : okAsync(userRow.parse(row).toDomain()),
    )
  }

  public delete(id: UserID): ResultAsync<void, UserNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(DELETE, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row => (row === null ? errAsync(new UserNotFoundError(id)) : okAsync(undefined)))
  }
}
