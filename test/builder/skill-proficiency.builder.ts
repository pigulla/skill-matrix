import { asProficiency } from '#/domain/skill/proficiency.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { SkillProficiency } from '#/domain/skill/skill-proficiency.js'

import { skills } from '../integration/fixture/fixture.js'

export type SkillProficiencyProperties = {
  skillId: string
  proficiency: number
}

export class SkillProficiencyBuilder {
  private properties: SkillProficiencyProperties = {
    skillId: skills.softwareArchitecture.id,
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

  public with(properties: Partial<SkillProficiencyProperties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create(properties?: Partial<SkillProficiencyProperties>): SkillProficiency {
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
