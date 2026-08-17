import type { JsonObject } from 'type-fest'
import z from 'zod'

import {
  SkillProficiency,
  skillProficiencySchema,
} from '../../skill/proficiency/skill-proficiency.js'
import { EXAMPLE_SKILL_ID, type SkillID } from '../../skill/skill-id.js'
import { type TeamID, teamIdSchema } from '../team-id.js'

import { InvalidTeamSkillProficienciesError } from './error/invalid-team-skill-proficiencies.error.js'

export const teamSkillProficienciesSchema = z.object({
  teamId: teamIdSchema,
  skills: z
    .array(skillProficiencySchema)
    .refine(items => new Set(items.map(i => i.skillId)).size === items.length, {
      message: 'Skill IDs must be unique within a team',
    })
    .meta({
      description: 'The skill proficiencies for the team.',
      example: [{ skillId: EXAMPLE_SKILL_ID, proficiency: 3 }],
    })
    .readonly(),
})

export type Properties = z.infer<typeof teamSkillProficienciesSchema>

export class TeamSkillProficiencies {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(TeamSkillProficiencies.name)

  public readonly teamId: TeamID
  public readonly skills: ReadonlyMap<SkillID, SkillProficiency>

  public constructor(data: Properties) {
    const result = teamSkillProficienciesSchema.safeParse(data)

    /* v8 ignore next -- @preserve */
    if (result.error) {
      throw new InvalidTeamSkillProficienciesError(result.error)
    }

    this.teamId = result.data.teamId
    this.skills = new Map(
      result.data.skills.map(skill => [skill.skillId, new SkillProficiency(skill)]),
    )
  }

  public toJSON(): JsonObject {
    return {
      teamId: this.teamId,
      skills: [...this.skills.values()].map(skill => skill.toJSON()),
    }
  }
}
