import { v4 } from 'uuid'

import { IUuidGenerator } from '#/application/uuid-generator.interface.js'

export class UuidGenerator implements IUuidGenerator {
  public generate(): string {
    return v4()
  }
}
