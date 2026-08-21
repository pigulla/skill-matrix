import { Injectable } from '@nestjs/common'

import type { IExampleKindUuidProvider } from '#/application/example/kind/example-kind-uuid-provider.interface.js'
import { IUuidGenerator } from '#/application/uuid-generator.interface.js'
import { type ExampleKindID, exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'

@Injectable()
export class ExampleKindUuidProvider implements IExampleKindUuidProvider {
  private readonly uuidGenerator: IUuidGenerator

  public constructor(uuidGenerator: IUuidGenerator) {
    this.uuidGenerator = uuidGenerator
  }

  public generate(): ExampleKindID {
    return exampleKindIdSchema.parse(this.uuidGenerator.generate())
  }
}
