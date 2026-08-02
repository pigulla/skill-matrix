import { DomainError } from './domain.error.js'

export abstract class EntityNotFoundError<T extends string> extends DomainError {
  public readonly id: T

  protected constructor(entityName: string, id: T) {
    super(`${entityName} with id "${id}" not found`)

    this.id = id
  }
}
