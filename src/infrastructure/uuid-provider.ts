import { v4 } from 'uuid'

import { IUuidProvider } from '#/application/uuid-provider.interface.js'

export abstract class UuidProvider<T extends string> extends IUuidProvider<T> {
  private readonly marker: string
  private readonly schema: { parse(data: unknown): T }

  protected constructor(marker: string, schema: { parse(data: unknown): T }) {
    super()

    this.marker = marker
    this.schema = schema
  }

  public generate(): T {
    const parts = v4().split('-')
    parts[1] = this.marker
    return this.schema.parse(parts.join('-'))
  }
}
