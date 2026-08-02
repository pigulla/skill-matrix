import { DomainError } from '../../error/domain.error.js'
import type { UserID } from '../user-id.js'

export class DuplicateUserIdError extends DomainError {
  public readonly id: UserID

  public constructor(id: UserID) {
    super('Duplicate user id')

    this.id = id
  }
}
