import { DomainError } from './domain.error.js'
import { type Identifier, serializeId } from './serialize-id.js'

export abstract class EntityReferenceNotFoundError<T extends Identifier> extends DomainError {
  public readonly id: T

  protected constructor(entityName: string, id: T) {
    super(
      `The referenced entity of type ${entityName} identified by ${serializeId(id)} was not found`,
    )

    this.id = id
  }
}
