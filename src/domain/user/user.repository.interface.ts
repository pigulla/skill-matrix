import type { ResultAsync } from 'neverthrow'

import type { TeamReferenceNotFoundError } from '../team/error/team-reference-not-found.error.js'

import type { DuplicateUserEmailError } from './error/duplicate-user-email.error.js'
import type { DuplicateUserIdError } from './error/duplicate-user-id.error.js'
import type { UserNotFoundError } from './error/user-not-found.error.js'
import type { User } from './user.js'
import type { UserID } from './user-id.js'

export abstract class IUserRepository {
  public abstract create(
    user: User,
  ): ResultAsync<User, DuplicateUserIdError | DuplicateUserEmailError | TeamReferenceNotFoundError>
  public abstract get(id: UserID): ResultAsync<User, UserNotFoundError>
  // No failure case exists yet, but this stays a ResultAsync (with an uninhabited error
  // type) so every method on this interface uses @ResultTransactional() uniformly.
  public abstract getAll(): ResultAsync<User[], never>
  public abstract update(
    user: User,
  ): ResultAsync<User, UserNotFoundError | DuplicateUserEmailError | TeamReferenceNotFoundError>
  public abstract delete(id: UserID): ResultAsync<void, UserNotFoundError>
}
