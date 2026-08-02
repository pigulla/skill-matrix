import type { Team } from './team.js'
import type { TeamID } from './team-id.js'

export abstract class ITeamRepository {
  public abstract delete(id: TeamID): Promise<void>

  public abstract getAll(): Promise<Team[]>

  public abstract get(id: TeamID): Promise<Team>

  public abstract create(team: Team): Promise<Team>

  public abstract update(team: Team): Promise<Team>
}
