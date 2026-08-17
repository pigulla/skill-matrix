import type { JsonObject } from 'type-fest'
import z from 'zod'

import { type SkillID, skillIdSchema } from '../skill-id.js'

import { InvalidSkillProficiencyError } from './error/invalid-skill-proficiency.error.js'
import { type Proficiency, proficiencySchema } from './proficiency.js'

export const skillProficiencySchema = z.object({
  skillId: skillIdSchema,
  proficiency: proficiencySchema,
})

export type Properties = z.infer<typeof skillProficiencySchema>

export class SkillProficiency implements Properties {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(SkillProficiency.name)

  public readonly skillId: SkillID
  public readonly proficiency: Proficiency

  public constructor(data: Properties) {
    const result = skillProficiencySchema.safeParse(data)

    /* v8 ignore next -- @preserve */
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
