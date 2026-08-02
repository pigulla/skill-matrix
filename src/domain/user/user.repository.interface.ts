import type { TeamID } from '../team/team-id.js'

import type { User } from './user.js'
import type { UserID } from './user-id.js'

export abstract class IUserRepository {
  public abstract delete(id: UserID): Promise<void>

  public abstract getAll(): Promise<User[]>

  public abstract get(id: UserID): Promise<User>

  public abstract create(user: User): Promise<User>

  public abstract update(user: User): Promise<User>

  public abstract assignTeam(userId: UserID, teamId: TeamID): Promise<User>
}
