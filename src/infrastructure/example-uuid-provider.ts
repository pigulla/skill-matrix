import { type ExampleID, exampleIdSchema } from '#/domain/example/example-id.js'
import { EntityIdMarker } from '#/domain/id-markers.js'

import { UuidProvider } from './uuid-provider.js'

export class ExampleUuidProvider extends UuidProvider<ExampleID> {
  public constructor() {
    super(EntityIdMarker.EXAMPLE, exampleIdSchema)
  }
}
