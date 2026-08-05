import type { IExampleUuidProvider } from '#/application/example/example-uuid-provider.interface.js'
import { type ExampleID, exampleIdSchema } from '#/domain/example/example-id.js'
import { EntityIdMarker } from '#/domain/id-markers.js'

import { UuidProvider } from './uuid-provider.js'

export class ExampleUuidProvider extends UuidProvider<ExampleID> implements IExampleUuidProvider {
  public constructor() {
    super(EntityIdMarker.EXAMPLE, exampleIdSchema)
  }
}
