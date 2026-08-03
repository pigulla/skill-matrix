import { Module } from '@nestjs/common'

import { ISkillService } from '#/application/skill/skill.service.interface.js'
import { SkillService } from '#/application/skill/skill.service.js'
import { ISkillUuidProvider } from '#/application/skill/skill-uuid-provider.interface.js'
import { ISkillRepository } from '#/domain/skill/skill.repository.interface.js'
import { SkillRepository } from '#/infrastructure/persistence/skill/skill.repository.js'
import { SkillUuidProvider } from '#/infrastructure/skill-uuid-provider.js'
import { ExampleModule } from '#/module/example.module.js'
import { SkillsController } from '#/presentation/http/skill/skills.controller.js'

import { DatabaseModule } from './database.module.js'

@Module({
  imports: [DatabaseModule, ExampleModule],
  controllers: [SkillsController],
  providers: [
    { provide: ISkillRepository, useClass: SkillRepository },
    { provide: ISkillService, useClass: SkillService },
    { provide: ISkillUuidProvider, useClass: SkillUuidProvider },
  ],
})
export class SkillModule {}
