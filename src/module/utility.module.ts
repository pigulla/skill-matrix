import { Module } from '@nestjs/common'

import { ITimeProvider } from '#/application/time-provider.interface.js'
import { IUuidGenerator } from '#/application/uuid-generator.interface.js'
import { TimeProvider } from '#/infrastructure/time-provider.js'
import { UuidGenerator } from '#/infrastructure/uuid/uuid-generator.js'

@Module({
  providers: [
    { provide: ITimeProvider, useClass: TimeProvider },
    { provide: IUuidGenerator, useClass: UuidGenerator },
  ],
  exports: [ITimeProvider, IUuidGenerator],
})
export class UtilityModule {}
