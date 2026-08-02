import type { ExampleID } from '#/domain/example/example-id.js'

import { IUuidProvider } from '../uuid-provider.interface.js'

export abstract class IExampleUuidProvider extends IUuidProvider<ExampleID> {}
