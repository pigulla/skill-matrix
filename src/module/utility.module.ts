import { Module } from '@nestjs/common'

import { ITimeProvider } from '#/application/time-provider.interface.js'
import { IUuidProvider } from '#/application/uuid-provider.interface.js'
import { TimeProvider } from '#/infrastructure/time-provider.js'
import { UuidProvider } from '#/infrastructure/uuid-provider.js'

@Module({
  providers: [
    { provide: ITimeProvider, useClass: TimeProvider },
    { provide: IUuidProvider, useClass: UuidProvider },
  ],
  exports: [ITimeProvider, IUuidProvider],
})
export class UtilityModule {}
