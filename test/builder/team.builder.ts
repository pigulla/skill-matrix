import { Team } from '#/domain/team/team.js'
import { asTeamID } from '#/domain/team/team-id.js'

import { UNKNOWN_TEAM_ID } from '../util/entity-ids.js'

export type TeamProperties = {
  id: string
  name: string
}

export class TeamBuilder {
  private properties: TeamProperties = {
    id: UNKNOWN_TEAM_ID,
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

  public static create<Full extends boolean = false>(
    ...args: Full extends true
      ? [properties: TeamProperties]
      : [properties?: Partial<TeamProperties>]
  ): Team {
    return new TeamBuilder().with(args[0] ?? {}).build()
  }

  public static from(team: Team): TeamBuilder {
    return new TeamBuilder().with({
      id: team.id,
      name: team.name,
    })
  }

  public build(): Team {
    return new Team({
      id: asTeamID(this.properties.id),
      name: this.properties.name,
    })
  }
}
