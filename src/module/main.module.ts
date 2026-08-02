import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ClsPluginTransactional } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { ClsModule } from 'nestjs-cls'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'

import { DB_CONNECTION } from '#/infrastructure/persistence/connection-provider.interface.js'
import { DEFAULT_TX_OPTIONS } from '#/infrastructure/persistence/default-transaction-options.js'
import { DomainErrorsExceptionFilter } from '#/presentation/http/domain-errors-exception-filter.js'

import { ConfigModule } from './config.module.js'
import { DatabaseModule } from './database.module.js'
import { ExampleModule } from './example.module.js'
import { HealthModule } from './health.module.js'
import { LoggingModule } from './logging.module.js'
import { SkillModule } from './skill.module.js'
import { TeamModule } from './team.module.js'
import { UserModule } from './user.module.js'

@Module({
  imports: [
    LoggingModule,
    ConfigModule,
    DatabaseModule,
    ClsModule.forRoot({
      plugins: [
        new ClsPluginTransactional({
          imports: [DatabaseModule],
          adapter: new TransactionalAdapterPgPromise({
            dbInstanceToken: DB_CONNECTION,
            defaultTxOptions: DEFAULT_TX_OPTIONS,
          }),
        }),
      ],
    }),
    UserModule,
    TeamModule,
    ExampleModule,
    SkillModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: DomainErrorsExceptionFilter },
  ],
})
export class MainModule {}
