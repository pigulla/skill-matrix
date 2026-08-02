import { EntityNotFoundError } from '../../error/entity-not-found.error.js'
import type { UserID } from '../user-id.js'

export class UserNotFoundError extends EntityNotFoundError<UserID> {
  public constructor(id: UserID) {
    super('User', id)
  }
}
