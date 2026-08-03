import type { ResultAsync } from 'neverthrow'

import type { SkillReferenceNotFoundError } from '../skill/error/skill-reference-not-found.error.js'
import type { SkillID } from '../skill/skill-id.js'
import type { SkillProficiency } from '../skill/skill-proficiency.js'

import type { DuplicateTeamSkillError } from './error/duplicate-team-skill.error.js'
import type { TeamNotFoundError } from './error/team-not-found.error.js'
import type { TeamReferenceNotFoundError } from './error/team-reference-not-found.error.js'
import type { TeamSkillNotFoundError } from './error/team-skill-not-found.error.js'
import type { TeamID } from './team-id.js'
import type { TeamSkillProficiencies } from './team-skill-proficiencies.js'

export abstract class ITeamSkillProficienciesRepository {
  public abstract get(teamId: TeamID): ResultAsync<TeamSkillProficiencies, TeamNotFoundError>

  public abstract add(
    teamId: TeamID,
    proficiency: SkillProficiency,
  ): ResultAsync<
    void,
    DuplicateTeamSkillError | SkillReferenceNotFoundError | TeamReferenceNotFoundError
  >

  public abstract update(
    teamId: TeamID,
    proficiency: SkillProficiency,
  ): ResultAsync<void, TeamSkillNotFoundError>

  public abstract remove(
    teamId: TeamID,
    skillId: SkillID,
  ): ResultAsync<void, TeamSkillNotFoundError>
}
