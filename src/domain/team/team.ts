import type { Except, JsonObject } from 'type-fest'
import z from 'zod'

import { InvalidTeamError } from './error/invalid-team.error.js'
import { type TeamID, teamIdSchema } from './team-id.js'

export const teamSchema = z.object({
  id: teamIdSchema,
  name: z.string().min(1).meta({
    description: 'The name of the team.',
    example: 'Platform',
  }),
})

export type Properties = z.infer<typeof teamSchema>

export class Team implements Properties {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(Team.name)

  public readonly id: TeamID
  public readonly name: string

  public constructor(properties: Properties) {
    const result = teamSchema.safeParse(properties)

    /* v8 ignore next -- @preserve */
    if (result.error) {
      throw new InvalidTeamError(result.error)
    }

    this.id = result.data.id
    this.name = result.data.name
  }

  public update(properties: Partial<Except<Properties, 'id'>>): Team {
    // Let's not rely on TypeScript only. The id should never be accidentally overwritten.
    return new Team({ ...this, ...properties, id: this.id })
  }

  public toJSON(): JsonObject {
    return {
      id: this.id,
      name: this.name,
    }
  }
}
