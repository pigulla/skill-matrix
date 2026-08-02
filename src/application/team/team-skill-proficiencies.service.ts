import { Injectable } from '@nestjs/common'
import { Transactional } from '@nestjs-cls/transactional'

import type { Proficiency } from '#/domain/skill/proficiency.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import { SkillProficiency } from '#/domain/skill/skill-proficiency.js'
import type { TeamID } from '#/domain/team/team-id.js'
import type { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'
import { ITeamSkillProficienciesRepository } from '#/domain/team/team-skill-proficiencies.repository.interface.js'

import { ITeamSkillProficienciesService } from './team-skill-proficiencies.service.interface.js'

@Injectable()
export class TeamSkillProficienciesService implements ITeamSkillProficienciesService {
  private readonly repository: ITeamSkillProficienciesRepository

  public constructor(repository: ITeamSkillProficienciesRepository) {
    this.repository = repository
  }

  @Transactional()
  public get(parameters: { teamId: TeamID }): Promise<TeamSkillProficiencies> {
    return this.repository.get(parameters.teamId)
  }

  @Transactional()
  public async add(parameters: {
    teamId: TeamID
    skillId: SkillID
    proficiency: Proficiency
  }): Promise<TeamSkillProficiencies> {
    await this.repository.add(
      parameters.teamId,
      new SkillProficiency({ skillId: parameters.skillId, proficiency: parameters.proficiency }),
    )
    return this.repository.get(parameters.teamId)
  }

  @Transactional()
  public async update(parameters: {
    teamId: TeamID
    skillId: SkillID
    proficiency: Proficiency
  }): Promise<TeamSkillProficiencies> {
    await this.repository.update(
      parameters.teamId,
      new SkillProficiency({ skillId: parameters.skillId, proficiency: parameters.proficiency }),
    )
    return this.repository.get(parameters.teamId)
  }

  @Transactional()
  public async remove(parameters: {
    teamId: TeamID
    skillId: SkillID
  }): Promise<TeamSkillProficiencies> {
    await this.repository.remove(parameters.teamId, parameters.skillId)
    return this.repository.get(parameters.teamId)
  }
}
