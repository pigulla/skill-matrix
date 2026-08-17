import type { ResultAsync } from 'neverthrow'

import type { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import type { Proficiency } from '#/domain/skill/proficiency/proficiency.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import type { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import type { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import type { DuplicateTeamSkillProficienciesError } from '#/domain/team/skill-proficiencies/error/duplicate-team-skill-proficiencies.error.js'
import type { TeamSkillProficienciesNotFoundError } from '#/domain/team/skill-proficiencies/error/team-skill-proficiencies-not-found.error.js'
import type { TeamSkillProficiencies } from '#/domain/team/skill-proficiencies/team-skill-proficiencies.js'
import type { TeamID } from '#/domain/team/team-id.js'

export abstract class ITeamSkillProficienciesService {
  public abstract get(parameters: {
    teamId: TeamID
  }): ResultAsync<TeamSkillProficiencies, TeamNotFoundError>

  public abstract add(parameters: {
    teamId: TeamID
    skillId: SkillID
    proficiency: Proficiency
  }): ResultAsync<
    TeamSkillProficiencies,
    DuplicateTeamSkillProficienciesError | SkillReferenceNotFoundError | TeamReferenceNotFoundError
  >

  public abstract update(parameters: {
    teamId: TeamID
    skillId: SkillID
    proficiency: Proficiency
  }): ResultAsync<TeamSkillProficiencies, TeamSkillProficienciesNotFoundError | TeamNotFoundError>

  public abstract remove(parameters: {
    teamId: TeamID
    skillId: SkillID
  }): ResultAsync<TeamSkillProficiencies, TeamSkillProficienciesNotFoundError | TeamNotFoundError>
}
