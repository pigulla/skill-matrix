import type { TeamID } from '#/domain/team/team-id.js'
import type { User } from '#/domain/user/user.js'
import type { UserID } from '#/domain/user/user-id.js'

export abstract class IUserService {
  public abstract create(data: {
    firstName: string
    lastName: string
    email: string
    teamId: TeamID
  }): Promise<User>
  public abstract delete(id: UserID): Promise<void>
  public abstract get(id: UserID): Promise<User>
  public abstract getAll(): Promise<User[]>
  public abstract update(data: {
    id: UserID
    firstName: string
    lastName: string
    email: string
  }): Promise<User>
  public abstract assignTeam(userId: UserID, teamId: TeamID): Promise<User>
}
