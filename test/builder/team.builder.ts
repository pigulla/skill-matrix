import { EntityIdMarker } from '#/domain/id-markers.js'
import { Team } from '#/domain/team/team.js'
import { asTeamID } from '#/domain/team/team-id.js'

export type TeamProperties = {
  id: string
  name: string
}

export class TeamBuilder {
  private properties: TeamProperties = {
    id: `deadbeef-${EntityIdMarker.TEAM}-4000-8000-000000000001`,
    name: 'Platform',
  }

  public withId(id: string): this {
    this.properties.id = id
    return this
  }

  public withName(name: string): this {
    this.properties.name = name
    return this
  }

  public with(properties: Partial<TeamProperties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create(properties?: Partial<TeamProperties>): Team {
    return new TeamBuilder().with(properties ?? {}).build()
  }

  public static from(team: Team): TeamBuilder {
    return new TeamBuilder().with(team)
  }

  public build(): Team {
    return new Team({
      id: asTeamID(this.properties.id),
      name: this.properties.name,
    })
  }
}
