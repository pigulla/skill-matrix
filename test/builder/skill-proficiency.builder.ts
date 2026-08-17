import { asProficiency } from '#/domain/skill/proficiency/proficiency.js'
import { SkillProficiency } from '#/domain/skill/proficiency/skill-proficiency.js'
import { asSkillID } from '#/domain/skill/skill-id.js'

import { UNKNOWN_SKILL_ID } from '../util/entity-ids.js'

type Properties = {
  skillId: string
  proficiency: number
}

export class SkillProficiencyBuilder {
  private properties: Properties = {
    skillId: UNKNOWN_SKILL_ID,
    proficiency: 2,
  }

  public withSkillId(skillId: string): this {
    this.properties.skillId = skillId
    return this
  }

  public withProficiency(proficiency: number): this {
    this.properties.proficiency = proficiency
    return this
  }

  public with(properties: Partial<Properties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create(properties?: Partial<Properties>): SkillProficiency {
    return new SkillProficiencyBuilder().with(properties ?? {}).build()
  }

  public static from(skillProficiency: SkillProficiency): SkillProficiencyBuilder {
    return new SkillProficiencyBuilder().with({
      skillId: skillProficiency.skillId,
      proficiency: skillProficiency.proficiency,
    })
  }

  public build(): SkillProficiency {
    return new SkillProficiency({
      skillId: asSkillID(this.properties.skillId),
      proficiency: asProficiency(this.properties.proficiency),
    })
  }
}
