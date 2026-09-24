import { v4 } from 'uuid'

import type { IUuidProvider } from '#/application/uuid-provider.interface.js'

export class UuidProvider implements IUuidProvider {
  public generate(): string {
    return v4()
  }
}
