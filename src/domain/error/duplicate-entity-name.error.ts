import { DuplicateEntityError } from './duplicate-entity.error.js'

export abstract class DuplicateEntityNameError extends DuplicateEntityError {
  protected constructor(entityName: string, name: string) {
    super(`Duplicate ${entityName} with name "${name}"`)
  }
}
