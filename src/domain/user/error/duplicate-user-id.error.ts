import { DuplicateEntityIdError } from '../../error/duplicate-entity-id.error.js'
import { User } from '../user.ts'
import type { UserID } from '../user-id.js'

export class DuplicateUserIdError extends DuplicateEntityIdError<UserID> {
  public constructor(id: UserID) {
    super(User.name, id)
  }
}
