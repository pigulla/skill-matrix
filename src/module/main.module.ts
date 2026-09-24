import { Module } from '@nestjs/common'

import { ConfigModule } from './config.module.js'
import { DatabaseModule } from './database.module.js'
import { ExampleModule } from './example.module.js'
import { HealthModule } from './health.module.js'
import { HttpCoreModule } from './http-core.module.js'
import { LoggingModule } from './logging.module.js'
import { SkillModule } from './skill.module.js'
import { TeamModule } from './team.module.js'
import { TransactionalModule } from './transactional.module.js'
import { UserModule } from './user.module.js'

@Module({
  imports: [
    LoggingModule,
    ConfigModule,
    DatabaseModule,
    TransactionalModule,
    HttpCoreModule,
    UserModule,
    TeamModule,
    ExampleModule,
    SkillModule,
    HealthModule,
  ],
})
export class MainModule {}
