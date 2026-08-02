import type { JsonObject } from 'type-fest'
import z from 'zod'

import { InvalidSkillProficiencyError } from './error/invalid-skill-proficiency.error.js'
import { type Proficiency, proficiencySchema } from './proficiency.js'
import { type SkillID, skillIdSchema } from './skill-id.js'

export const skillProficiencySchema = z.object({
  skillId: skillIdSchema,
  proficiency: proficiencySchema,
})

export type SkillProficiencyProperties = {
  skillId: SkillID
  proficiency: Proficiency
}

export class SkillProficiency {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(SkillProficiency.name)

  public readonly skillId: SkillID
  public readonly proficiency: Proficiency

  public constructor(data: SkillProficiencyProperties) {
    const result = skillProficiencySchema.safeParse(data)

    if (result.error) {
      throw new InvalidSkillProficiencyError(result.error)
    }

    this.skillId = result.data.skillId
    this.proficiency = result.data.proficiency
  }

  public toJSON(): JsonObject {
    return {
      skillId: this.skillId,
      proficiency: this.proficiency,
    }
  }
}
