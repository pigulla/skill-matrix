import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'

export class DuplicateUserEmailError extends DuplicateEntityError {
  public readonly email: string

  public constructor(email: string) {
    super('Duplicate user email')

    this.email = email
  }
}
