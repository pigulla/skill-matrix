import { asProficiency } from '#/domain/skill/proficiency/proficiency.js'
import { SkillProficiency } from '#/domain/skill/proficiency/skill-proficiency.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'

import { teams } from '../integration/fixture/fixture.js'

type Properties = {
  skillId: string
  proficiency: number
}

export type TeamSkillProficiencyProperties = {
  teamId: string
  skills: Properties[]
}

export class TeamSkillProficienciesBuilder {
  private properties: TeamSkillProficiencyProperties = {
    teamId: teams.platformEngineering.id,
    skills: [],
  }

  public withTeamId(teamId: string): this {
    this.properties.teamId = teamId
    return this
  }

  public withSkills(skills: Properties[]): this {
    this.properties.skills = [...skills]
    return this
  }

  public with(properties: Partial<TeamSkillProficiencyProperties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create<Full extends boolean = false>(
    ...args: Full extends true
      ? [properties: TeamSkillProficiencyProperties]
      : [properties?: Partial<TeamSkillProficiencyProperties>]
  ): TeamSkillProficiencies {
    return new TeamSkillProficienciesBuilder().with(args[0] ?? {}).build()
  }

  public static from(tsp: TeamSkillProficiencies): TeamSkillProficienciesBuilder {
    return new TeamSkillProficienciesBuilder().with({
      teamId: tsp.teamId,
      skills: [...tsp.skills.values()].map(s => ({
        skillId: s.skillId,
        proficiency: s.proficiency,
      })),
    })
  }

  public build(): TeamSkillProficiencies {
    return new TeamSkillProficiencies({
      teamId: asTeamID(this.properties.teamId),
      items: this.properties.skills.map(
        skill =>
          new SkillProficiency({
            skillId: asSkillID(skill.skillId),
            proficiency: asProficiency(skill.proficiency),
          }),
      ),
    })
  }
}
