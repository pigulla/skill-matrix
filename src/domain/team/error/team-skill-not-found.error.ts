import { EntityNotFoundError } from '../../error/entity-not-found.error.js'
import type { SkillID } from '../../skill/skill-id.js'
import type { TeamID } from '../team-id.js'
import { TeamSkillProficiencies } from '../team-skill-proficiencies.js'

// TODO: EntityNotFoundError<T> takes a single ID, so only teamId is used as the primary
// identifier here and the message omits skillId. Consider a two-ID base class if precision matters.
export class TeamSkillNotFoundError extends EntityNotFoundError<TeamID> {
  public readonly skillId: SkillID

  public constructor({ teamId, skillId }: { teamId: TeamID; skillId: SkillID }) {
    super(TeamSkillProficiencies.name, teamId)
    this.skillId = skillId
  }
}
