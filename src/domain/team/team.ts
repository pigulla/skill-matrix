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

  public constructor(data: { id: TeamID; name: string }) {
    const result = teamSchema.safeParse(data)

    if (result.error) {
      throw new InvalidTeamError(result.error)
    }

    this.id = result.data.id
    this.name = result.data.name
  }

  public update(data: Partial<Except<Properties, 'id'>>): Team {
    return new Team({ ...this, ...data })
  }

  public toJSON(): JsonObject {
    return {
      id: this.id,
      name: this.name,
    }
  }
}
