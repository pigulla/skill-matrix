import { Module } from '@nestjs/common'

import { IExampleService } from '#/application/example/example.service.interface.js'
import { ExampleService } from '#/application/example/example.service.js'
import { IExampleUuidProvider } from '#/application/example/example-uuid-provider.interface.js'
import { IExampleKindService } from '#/application/example/kind/example-kind.service.interface.js'
import { ExampleKindService } from '#/application/example/kind/example-kind.service.js'
import { IExampleKindUuidProvider } from '#/application/example/kind/example-kind-uuid-provider.interface.js'
import { IUuidProvider } from '#/application/uuid-provider.interface.js'
import { IExampleRepository } from '#/domain/example/example.repository.interface.js'
import { IExampleKindRepository } from '#/domain/example/kind/example-kind.repository.interface.js'
import { ExampleRepository } from '#/infrastructure/persistence/example/example.repository.js'
import { ExampleKindRepository } from '#/infrastructure/persistence/example/kind/example-kind.repository.js'
import { ExamplesController } from '#/presentation/http/example/examples.controller.js'
import { ExampleKindsController } from '#/presentation/http/example/kind/example-kinds.controller.js'

import { DatabaseModule } from './database.module.js'
import { UtilityModule } from './utility.module.js'

@Module({
  imports: [DatabaseModule, UtilityModule],
  controllers: [ExampleKindsController, ExamplesController],
  providers: [
    { provide: IExampleRepository, useClass: ExampleRepository },
    { provide: IExampleService, useClass: ExampleService },
    { provide: IExampleUuidProvider, useExisting: IUuidProvider },
    { provide: IExampleKindRepository, useClass: ExampleKindRepository },
    { provide: IExampleKindService, useClass: ExampleKindService },
    { provide: IExampleKindUuidProvider, useExisting: IUuidProvider },
  ],
})
export class ExampleModule {}
