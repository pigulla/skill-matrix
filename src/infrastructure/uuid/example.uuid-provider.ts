import { Injectable } from '@nestjs/common'

import type { IExampleUuidProvider } from '#/application/example/example-uuid-provider.interface.js'
import { IUuidGenerator } from '#/application/uuid-generator.interface.js'
import { type ExampleID, exampleIdSchema } from '#/domain/example/example-id.js'

@Injectable()
export class ExampleUuidProvider implements IExampleUuidProvider {
  private readonly uuidGenerator: IUuidGenerator

  public constructor(uuidGenerator: IUuidGenerator) {
    this.uuidGenerator = uuidGenerator
  }

  public generate(): ExampleID {
    return exampleIdSchema.parse(this.uuidGenerator.generate())
  }
}
