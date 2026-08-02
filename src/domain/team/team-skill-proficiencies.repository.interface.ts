import type { SkillID } from '../skill/skill-id.js'
import type { SkillProficiency } from '../skill/skill-proficiency.js'

import type { TeamID } from './team-id.js'
import type { TeamSkillProficiencies } from './team-skill-proficiencies.js'

export abstract class ITeamSkillProficienciesRepository {
  public abstract get(teamId: TeamID): Promise<TeamSkillProficiencies>

  public abstract add(teamId: TeamID, proficiency: SkillProficiency): Promise<void>

  public abstract update(teamId: TeamID, proficiency: SkillProficiency): Promise<void>

  public abstract remove(teamId: TeamID, skillId: SkillID): Promise<void>
}
