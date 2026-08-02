import { DomainError } from './domain.error.js'

export abstract class EntityReferenceNotFoundError<T extends string> extends DomainError {
  public readonly id: T

  protected constructor(entityName: string, id: T) {
    super(`Referenced ${entityName} with id "${id}" not found`)

    this.id = id
  }
}
