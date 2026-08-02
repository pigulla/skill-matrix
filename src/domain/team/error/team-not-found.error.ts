import { EntityNotFoundError } from '../../error/entity-not-found.error.js'
import type { TeamID } from '../team-id.js'

export class TeamNotFoundError extends EntityNotFoundError<TeamID> {
  public constructor(id: TeamID) {
    super('Team', id)
  }
}
