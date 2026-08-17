import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'
import { User } from '../user.js'

export class DuplicateUserEmailError extends DuplicateEntityError<{ email: string }> {
  public constructor(email: string) {
    super(User.name, { email })
  }
}
