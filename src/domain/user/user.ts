import type { Except, JsonObject } from 'type-fest'
import z from 'zod'

import { type TeamID, teamIdSchema } from '../team/team-id.js'

import { InvalidUserError } from './error/invalid-user.error.js'
import { type UserID, userIdSchema } from './user-id.js'

export const userSchema = z.object({
  id: userIdSchema,
  email: z.email().meta({
    description: 'The email address of the user.',
    example: 'peter.pan@example.com',
  }),
  firstName: z.string().min(1).meta({
    description: 'The first name of the user.',
    example: 'Peter',
  }),
  lastName: z.string().min(1).meta({
    description: 'The last name of the user.',
    example: 'Pan',
  }),
  teamId: teamIdSchema,
})

type Properties = {
  id: UserID
  email: string
  firstName: string
  lastName: string
  teamId: TeamID
}

export class User {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(User.name)

  public readonly id: UserID
  public readonly email: string
  public readonly firstName: string
  public readonly lastName: string
  public readonly teamId: TeamID

  public constructor(data: Properties) {
    const result = userSchema.safeParse(data)

    if (result.error) {
      throw new InvalidUserError(result.error)
    }

    this.id = result.data.id
    this.email = result.data.email
    this.firstName = result.data.firstName
    this.lastName = result.data.lastName
    this.teamId = result.data.teamId
  }

  public update(data: Partial<Except<Properties, 'id'>>): User {
    return new User({ ...this, ...data })
  }

  public toJSON(): JsonObject {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      teamId: this.teamId,
    }
  }
}
