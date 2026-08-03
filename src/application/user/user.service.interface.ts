import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import type { DuplicateUserEmailError } from '#/domain/user/error/duplicate-user-email.error.js'
import type { DuplicateUserIdError } from '#/domain/user/error/duplicate-user-id.error.js'
import type { UserNotFoundError } from '#/domain/user/error/user-not-found.error.js'
import type { Properties, User } from '#/domain/user/user.js'
import type { UserID } from '#/domain/user/user-id.js'

export abstract class IUserService {
  public abstract create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<User, DuplicateUserIdError | DuplicateUserEmailError | TeamReferenceNotFoundError>
  public abstract delete(id: UserID): ResultAsync<void, UserNotFoundError>
  public abstract get(id: UserID): ResultAsync<User, UserNotFoundError>
  // No failure case exists yet, but this stays a ResultAsync (with an uninhabited error
  // type) so every method on this interface uses @ResultTransactional() uniformly.
  public abstract getAll(): ResultAsync<User[], never>
  public abstract update(
    properties: SetRequired<Partial<Properties>, 'id'>,
  ): ResultAsync<User, UserNotFoundError | DuplicateUserEmailError | TeamReferenceNotFoundError>
}
