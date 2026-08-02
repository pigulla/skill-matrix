import type { Proficiency } from '#/domain/skill/proficiency.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import type { TeamID } from '#/domain/team/team-id.js'
import type { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'

export abstract class ITeamSkillProficienciesService {
  public abstract get(parameters: { teamId: TeamID }): Promise<TeamSkillProficiencies>

  public abstract add(parameters: {
    teamId: TeamID
    skillId: SkillID
    proficiency: Proficiency
  }): Promise<TeamSkillProficiencies>

  public abstract update(parameters: {
    teamId: TeamID
    skillId: SkillID
    proficiency: Proficiency
  }): Promise<TeamSkillProficiencies>

  public abstract remove(parameters: {
    teamId: TeamID
    skillId: SkillID
  }): Promise<TeamSkillProficiencies>
}
