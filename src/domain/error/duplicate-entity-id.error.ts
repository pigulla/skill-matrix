import { DuplicateEntityError } from './duplicate-entity.error.js'

export abstract class DuplicateEntityIdError<T extends string> extends DuplicateEntityError {
  public readonly id: T

  protected constructor(entityName: string, id: T) {
    super(`Duplicate ${entityName} with id "${id}"`)

    this.id = id
  }
}
