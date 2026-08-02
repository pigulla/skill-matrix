import { Module } from '@nestjs/common'

import { ITeamService } from '#/application/team/team.service.interface.js'
import { TeamService } from '#/application/team/team.service.js'
import { ITeamSkillProficienciesService } from '#/application/team/team-skill-proficiencies.service.interface.js'
import { TeamSkillProficienciesService } from '#/application/team/team-skill-proficiencies.service.js'
import { ITeamUuidProvider } from '#/application/team/team-uuid-provider.interface.js'
import { ITeamRepository } from '#/domain/team/team.repository.interface.js'
import { ITeamSkillProficienciesRepository } from '#/domain/team/team-skill-proficiencies.repository.interface.js'
import { TeamRepository } from '#/infrastructure/persistence/team/team.repository.js'
import { TeamSkillProficienciesRepository } from '#/infrastructure/persistence/team/team-skill-proficiencies.repository.js'
import { TeamUuidProvider } from '#/infrastructure/team-uuid-provider.js'
import { TeamSkillsController } from '#/presentation/http/team/team-skills.controller.js'
import { TeamsController } from '#/presentation/http/team/teams.controller.js'

import { DatabaseModule } from './database.module.js'
import { UtilityModule } from './utility.module.js'

@Module({
  imports: [DatabaseModule, UtilityModule],
  controllers: [TeamsController, TeamSkillsController],
  providers: [
    { provide: ITeamRepository, useClass: TeamRepository },
    { provide: ITeamService, useClass: TeamService },
    { provide: ITeamSkillProficienciesRepository, useClass: TeamSkillProficienciesRepository },
    { provide: ITeamSkillProficienciesService, useClass: TeamSkillProficienciesService },
    { provide: ITeamUuidProvider, useClass: TeamUuidProvider },
  ],
})
export class TeamModule {}
