import type { Team } from '#/domain/team/team.js'
import type { TeamID } from '#/domain/team/team-id.js'

export abstract class ITeamService {
  public abstract create(data: { name: string }): Promise<Team>
  public abstract delete(id: TeamID): Promise<void>
  public abstract get(id: TeamID): Promise<Team>
  public abstract getAll(): Promise<Team[]>
  public abstract update(team: Team): Promise<Team>
}
