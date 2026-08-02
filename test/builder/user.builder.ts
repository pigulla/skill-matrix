import { EntityIdMarker } from '#/domain/id-markers.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { User } from '#/domain/user/user.js'
import { asUserID } from '#/domain/user/user-id.js'

export type UserProperties = {
  id: string
  firstName: string
  lastName: string
  email: string
  teamId: string
}

export class UserBuilder {
  private properties: UserProperties = {
    id: `00000000-${EntityIdMarker.USER}-4000-8000-000000000000`,
    firstName: 'Peter',
    lastName: 'Pan',
    email: 'peter.pan@example.com',
    teamId: `00000000-${EntityIdMarker.TEAM}-4000-8000-000000000000`,
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

  public static create(properties?: Partial<UserProperties>): User {
    return new UserBuilder().with(properties ?? {}).build()
  }

  public static from(user: User): UserBuilder {
    return new UserBuilder().with(user)
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
