import { DuplicateEntityError } from '../../error/duplicate-entity.error.js'
import type { SkillID } from '../../skill/skill-id.js'
import { Team } from '../team.js'
import type { TeamID } from '../team-id.js'

export class DuplicateTeamSkillError extends DuplicateEntityError {
  public readonly teamId: TeamID
  public readonly skillId: SkillID

  public constructor(teamId: TeamID, skillId: SkillID) {
    super(`${Team.name} "${teamId}" already has a skill proficiency for skill "${skillId}"`)
    this.teamId = teamId
    this.skillId = skillId
  }
}
