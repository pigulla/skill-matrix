import type { ExampleKindID } from '#/domain/example/kind/example-kind-id.js'

import { IUuidProvider } from '../../uuid-provider.interface.js'

export abstract class IExampleKindUuidProvider extends IUuidProvider<ExampleKindID> {}
