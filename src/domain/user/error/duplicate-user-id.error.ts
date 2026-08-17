import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'
import { User } from '../user.js'
import type { UserID } from '../user-id.js'

export class DuplicateUserIdError extends DuplicateEntityError<UserID> {
  public constructor(id: UserID) {
    super(User.name, id)
  }
}
