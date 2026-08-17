import { DomainError } from './domain.error.js'
import { type Identifier, serializeId } from './serialize-id.js'

export abstract class EntityInUseError<T extends Identifier> extends DomainError {
  public readonly id: T

  protected constructor(entityName: string, id: T) {
    super(`Entity of type ${entityName} identified by ${serializeId(id)} is in use`)

    this.id = id
  }
}
