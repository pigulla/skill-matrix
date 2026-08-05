import { asTeamID } from '#/domain/team/team-id.js'
import { User } from '#/domain/user/user.js'
import { asUserID } from '#/domain/user/user-id.js'

import { UNKNOWN_TEAM_ID, UNKNOWN_USER_ID } from '../util/entity-ids.js'

export type UserProperties = {
  id: string
  firstName: string
  lastName: string
  email: string
  teamId: string
}

export class UserBuilder {
  private properties: UserProperties = {
    id: UNKNOWN_USER_ID,
    firstName: 'Peter',
    lastName: 'Pan',
    email: 'peter.pan@example.com',
    teamId: UNKNOWN_TEAM_ID,
  }

  public withId(id: string): this {
    this.properties.id = id
    return this
  }

  public withFirstName(firstName: string): this {
    this.properties.firstName = firstName
    return this
  }

  public withLastName(lastName: string): this {
    this.properties.lastName = lastName
    return this
  }

  public withEmail(email: string): this {
    this.properties.email = email
    return this
  }

  public withTeamId(teamId: string): this {
    this.properties.teamId = teamId
    return this
  }

  public with(properties: Partial<UserProperties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create<Full extends boolean = false>(
    ...args: Full extends true
      ? [properties: UserProperties]
      : [properties?: Partial<UserProperties>]
  ): User {
    return new UserBuilder().with(args[0] ?? {}).build()
  }

  public static from(user: User): UserBuilder {
    return new UserBuilder().with({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      teamId: user.teamId,
    })
  }

  public build(): User {
    return new User({
      id: asUserID(this.properties.id),
      firstName: this.properties.firstName,
      lastName: this.properties.lastName,
      email: this.properties.email,
      teamId: asTeamID(this.properties.teamId),
    })
  }
}
