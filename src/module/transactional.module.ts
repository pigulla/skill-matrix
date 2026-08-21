import { Module } from '@nestjs/common'
import { ClsPluginTransactional } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { ClsModule } from 'nestjs-cls'

import { DB_CONNECTION } from '#/infrastructure/persistence/connection-provider.interface.js'
import { DEFAULT_TX_OPTIONS } from '#/infrastructure/persistence/default-transaction-options.js'

import { DatabaseModule } from './database.module.js'

/**
 * Owns the CLS transaction plugin and, with it, the isolation level every transaction runs at.
 *
 * Kept separate from DatabaseModule because `ClsModule.forRoot()` is a register-once-at-the-root
 * concern while DatabaseModule is imported by every feature module. `ClsRootModule` is `@Global()`,
 * so importing this module once makes `TransactionHost` injectable everywhere.
 */
@Module({
  imports: [
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
  ],
})
export class TransactionalModule {}
