import type { IExampleKindUuidProvider } from '#/application/example-kind/example-kind-uuid-provider.interface.js'
import { type ExampleKindID, exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'
import { EntityIdMarker } from '#/domain/id-markers.js'

import { UuidProvider } from './uuid-provider.js'

export class ExampleKindUuidProvider
  extends UuidProvider<ExampleKindID>
  implements IExampleKindUuidProvider
{
  public constructor() {
    super(EntityIdMarker.EXAMPLE_KIND, exampleKindIdSchema)
  }
}
