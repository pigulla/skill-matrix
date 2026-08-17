import { EntityNotFoundError } from '../../../error/entity-not-found.error.js'
import type { SkillID } from '../../../skill/skill-id.js'
import type { TeamID } from '../../team-id.js'
import { TeamSkillProficiencies } from '../team-skill-proficiencies.js'

export class TeamSkillProficienciesNotFoundError extends EntityNotFoundError<{
  teamId: TeamID
  skillId: SkillID
}> {
  public constructor({ teamId, skillId }: { teamId: TeamID; skillId: SkillID }) {
    super(TeamSkillProficiencies.name, { teamId, skillId })
  }
}
