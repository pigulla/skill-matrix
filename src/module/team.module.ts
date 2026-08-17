import { Module } from '@nestjs/common'

import { ITeamSkillProficienciesService } from '#/application/team/skill-proficiencies/team-skill-proficiencies.service.interface.js'
import { TeamSkillProficienciesService } from '#/application/team/skill-proficiencies/team-skill-proficiencies.service.js'
import { ITeamService } from '#/application/team/team.service.interface.js'
import { TeamService } from '#/application/team/team.service.js'
import { ITeamUuidProvider } from '#/application/team/team-uuid-provider.interface.js'
import { ITeamSkillProficienciesRepository } from '#/domain/team/skill-proficiencies/team-skill-proficiencies.repository.interface.js'
import { ITeamRepository } from '#/domain/team/team.repository.interface.js'
import { TeamRepository } from '#/infrastructure/persistence/team/team.repository.js'
import { TeamSkillProficienciesRepository } from '#/infrastructure/persistence/team/team-skill-proficiencies.repository.js'
import { TeamUuidProvider } from '#/infrastructure/uuid/team.uuid-provider.js'
import { TeamSkillProficienciesController } from '#/presentation/http/team/skill-proficiencies/team-skill-proficiencies.controller.js'
import { TeamsController } from '#/presentation/http/team/teams.controller.js'

import { DatabaseModule } from './database.module.js'
import { UtilityModule } from './utility.module.js'

@Module({
  imports: [DatabaseModule, UtilityModule],
  controllers: [TeamSkillProficienciesController, TeamsController],
  providers: [
    { provide: ITeamRepository, useClass: TeamRepository },
    { provide: ITeamService, useClass: TeamService },
    { provide: ITeamSkillProficienciesRepository, useClass: TeamSkillProficienciesRepository },
    { provide: ITeamSkillProficienciesService, useClass: TeamSkillProficienciesService },
    { provide: ITeamUuidProvider, useClass: TeamUuidProvider },
  ],
})
export class TeamModule {}
