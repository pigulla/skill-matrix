import type { ResultAsync } from 'neverthrow'

import type { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import type { Proficiency } from '#/domain/skill/proficiency/proficiency.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import type { DuplicateTeamSkillError } from '#/domain/team/error/duplicate-team-skill.error.js'
import type { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import type { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import type { TeamSkillNotFoundError } from '#/domain/team/error/team-skill-not-found.error.js'
import type { TeamID } from '#/domain/team/team-id.js'
import type { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'

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
    | DuplicateTeamSkillError
    | SkillReferenceNotFoundError
    | TeamReferenceNotFoundError
    | TeamNotFoundError
  >

  public abstract update(parameters: {
    teamId: TeamID
    skillId: SkillID
    proficiency: Proficiency
  }): ResultAsync<TeamSkillProficiencies, TeamSkillNotFoundError | TeamNotFoundError>

  public abstract remove(parameters: {
    teamId: TeamID
    skillId: SkillID
  }): ResultAsync<TeamSkillProficiencies, TeamSkillNotFoundError | TeamNotFoundError>
}
