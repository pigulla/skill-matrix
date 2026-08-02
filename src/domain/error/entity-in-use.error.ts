import { DomainError } from './domain.error.js'

export abstract class EntityInUseError<T extends string> extends DomainError {
  public readonly id: T

  protected constructor(entityName: string, id: T) {
    super(`${entityName} with id "${id}" is in use`)

    this.id = id
  }
}
