import { EntityIdMarker } from '#/domain/id-markers.js'
import { asProficiency } from '#/domain/skill/proficiency.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { SkillProficiency } from '#/domain/skill/skill-proficiency.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'

type SkillProperties = {
  skillId: string
  proficiency: number
}

type BuilderProperties = {
  teamId: string
  skills: SkillProperties[]
}

export class TeamSkillProficienciesBuilder {
  private properties: BuilderProperties = {
    teamId: `40000000-${EntityIdMarker.TEAM}-4000-8000-000000000001`,
    skills: [],
  }

  public withTeamId(teamId: string): this {
    this.properties.teamId = teamId
    return this
  }

  public withSkills(skills: SkillProperties[]): this {
    this.properties.skills = skills
    return this
  }

  public with(properties: Partial<BuilderProperties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create(properties?: Partial<BuilderProperties>): TeamSkillProficiencies {
    return new TeamSkillProficienciesBuilder().with(properties ?? {}).build()
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
