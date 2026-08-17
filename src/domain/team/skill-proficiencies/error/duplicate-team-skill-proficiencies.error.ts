import { DuplicateEntityError } from '../../../error/duplicate-entity.error.js'
import type { SkillID } from '../../../skill/skill-id.js'
import type { TeamID } from '../../team-id.js'
import { TeamSkillProficiencies } from '../team-skill-proficiencies.js'

export class DuplicateTeamSkillProficienciesError extends DuplicateEntityError<{
  teamId: TeamID
  skillId: SkillID
}> {
  public constructor({ teamId, skillId }: { teamId: TeamID; skillId: SkillID }) {
    super(TeamSkillProficiencies.name, { teamId, skillId })
  }
}
