import type { JsonObject } from 'type-fest'
import z from 'zod'

import type { SkillID } from '../skill/skill-id.js'
import { SkillProficiency, skillProficiencySchema } from '../skill/skill-proficiency.js'

import { InvalidTeamSkillProficienciesError } from './error/invalid-team-skill-proficiencies.error.js'
import { type TeamID, teamIdSchema } from './team-id.js'

export const teamSkillProficienciesSchema = z.object({
  teamId: teamIdSchema,
  skills: z
    .array(skillProficiencySchema)
    .refine(items => new Set(items.map(i => i.skillId)).size === items.length, {
      message: 'Skill IDs must be unique within a team',
    }),
})

export type TeamSkillProficienciesProperties = {
  teamId: TeamID
  items: Iterable<SkillProficiency>
}

export class TeamSkillProficiencies {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(TeamSkillProficiencies.name)

  public readonly teamId: TeamID
  public readonly skills: ReadonlyMap<SkillID, SkillProficiency>

  public constructor(data: TeamSkillProficienciesProperties) {
    const items = [...data.items]
    const result = teamSkillProficienciesSchema.safeParse({ teamId: data.teamId, skills: items })

    if (result.error) {
      throw new InvalidTeamSkillProficienciesError(result.error)
    }

    this.teamId = result.data.teamId
    this.skills = new Map(result.data.skills.map(s => [s.skillId, new SkillProficiency(s)]))
  }

  public toJSON(): JsonObject {
    return {
      teamId: this.teamId,
      skills: [...this.skills.values()].map(s => s.toJSON()),
    }
  }
}
