import { Module } from '@nestjs/common'

import { IExampleService } from '#/application/example/example.service.interface.js'
import { ExampleService } from '#/application/example/example.service.js'
import { IExampleUuidProvider } from '#/application/example/example-uuid-provider.interface.js'
import { IExampleKindService } from '#/application/example-kind/example-kind.service.interface.js'
import { ExampleKindService } from '#/application/example-kind/example-kind.service.js'
import { IExampleKindUuidProvider } from '#/application/example-kind/example-kind-uuid-provider.interface.js'
import { IExampleRepository } from '#/domain/example/example.repository.interface.js'
import { IExampleKindRepository } from '#/domain/example/kind/example-kind.repository.interface.js'
import { ExampleRepository } from '#/infrastructure/persistence/example/example.repository.js'
import { ExampleKindRepository } from '#/infrastructure/persistence/example/kind/example-kind.repository.js'
import { ExampleUuidProvider } from '#/infrastructure/uuid/example.uuid-provider.js'
import { ExampleKindUuidProvider } from '#/infrastructure/uuid/example-kind.uuid-provider.js'
import { ExamplesController } from '#/presentation/http/example/examples.controller.js'
import { ExampleKindsController } from '#/presentation/http/example/kind/example-kinds.controller.js'

import { DatabaseModule } from './database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [ExampleKindsController, ExamplesController],
  providers: [
    { provide: IExampleRepository, useClass: ExampleRepository },
    { provide: IExampleService, useClass: ExampleService },
    { provide: IExampleUuidProvider, useClass: ExampleUuidProvider },
    { provide: IExampleKindRepository, useClass: ExampleKindRepository },
    { provide: IExampleKindService, useClass: ExampleKindService },
    { provide: IExampleKindUuidProvider, useClass: ExampleKindUuidProvider },
  ],
  exports: [IExampleRepository],
})
export class ExampleModule {}
