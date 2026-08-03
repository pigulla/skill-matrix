import { Module } from '@nestjs/common'

import { IExampleService } from '#/application/example/example.service.interface.js'
import { ExampleService } from '#/application/example/example.service.js'
import { IExampleUuidProvider } from '#/application/example/example-uuid-provider.interface.js'
import { IExampleKindService } from '#/application/example-kind/example-kind.service.interface.js'
import { ExampleKindService } from '#/application/example-kind/example-kind.service.js'
import { IExampleRepository } from '#/domain/example/example.repository.interface.js'
import { IExampleKindRepository } from '#/domain/example-kind/example-kind.repository.interface.js'
import { ExampleUuidProvider } from '#/infrastructure/example-uuid-provider.js'
import { ExampleRepository } from '#/infrastructure/persistence/example/example.repository.js'
import { ExampleKindRepository } from '#/infrastructure/persistence/example-kind/example-kind.repository.js'
import { ExamplesController } from '#/presentation/http/example/examples.controller.js'

import { DatabaseModule } from './database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [ExamplesController],
  providers: [
    { provide: IExampleRepository, useClass: ExampleRepository },
    { provide: IExampleService, useClass: ExampleService },
    { provide: IExampleUuidProvider, useClass: ExampleUuidProvider },
    { provide: IExampleKindRepository, useClass: ExampleKindRepository },
    { provide: IExampleKindService, useClass: ExampleKindService },
  ],
  exports: [IExampleRepository],
})
export class ExampleModule {}
