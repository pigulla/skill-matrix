import { DomainError } from './domain.error.js'
import { type Identifier, serializeId } from './serialize-id.js'

export abstract class DuplicateEntityError<T extends Identifier> extends DomainError {
  public readonly id: T

  protected constructor(entityName: string, id: T) {
    super(`Duplicate entity of type ${entityName} (${serializeId(id)})`)

    this.id = id
  }
}
