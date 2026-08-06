import { Injectable } from '@nestjs/common'
import type { ResultAsync } from 'neverthrow'

import type { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import type { Proficiency } from '#/domain/skill/proficiency/proficiency.js'
import { SkillProficiency } from '#/domain/skill/proficiency/skill-proficiency.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import type { DuplicateTeamSkillError } from '#/domain/team/error/duplicate-team-skill.error.js'
import type { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import type { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import type { TeamSkillNotFoundError } from '#/domain/team/error/team-skill-not-found.error.js'
import type { TeamID } from '#/domain/team/team-id.js'
import type { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'
import { ITeamSkillProficienciesRepository } from '#/domain/team/team-skill-proficiencies.repository.interface.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

import { ITeamSkillProficienciesService } from './team-skill-proficiencies.service.interface.js'

@Injectable()
export class TeamSkillProficienciesService implements ITeamSkillProficienciesService {
  private readonly repository: ITeamSkillProficienciesRepository

  public constructor(repository: ITeamSkillProficienciesRepository) {
    this.repository = repository
  }

  @ResultTransactional()
  public get(parameters: {
    teamId: TeamID
  }): ResultAsync<TeamSkillProficiencies, TeamNotFoundError> {
    return this.repository.get(parameters.teamId)
  }

  @ResultTransactional()
  public add(parameters: {
    teamId: TeamID
    skillId: SkillID
    proficiency: Proficiency
  }): ResultAsync<
    TeamSkillProficiencies,
    | DuplicateTeamSkillError
    | SkillReferenceNotFoundError
    | TeamReferenceNotFoundError
    | TeamNotFoundError
  > {
    const { teamId, skillId, proficiency } = parameters

    return this.repository
      .add(teamId, new SkillProficiency({ skillId, proficiency }))
      .andThen(() => this.repository.get(teamId))
  }

  @ResultTransactional()
  public update(parameters: {
    teamId: TeamID
    skillId: SkillID
    proficiency: Proficiency
  }): ResultAsync<TeamSkillProficiencies, TeamSkillNotFoundError | TeamNotFoundError> {
    const { teamId, skillId, proficiency } = parameters

    return this.repository
      .update(teamId, new SkillProficiency({ skillId, proficiency }))
      .andThen(() => this.repository.get(teamId))
  }

  @ResultTransactional()
  public remove(parameters: {
    teamId: TeamID
    skillId: SkillID
  }): ResultAsync<TeamSkillProficiencies, TeamSkillNotFoundError | TeamNotFoundError> {
    const { teamId, skillId } = parameters

    return this.repository.remove(teamId, skillId).andThen(() => this.repository.get(teamId))
  }
}
