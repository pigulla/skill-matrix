import { EntityConcurrencyError } from '../../error/entity-concurrency.error.js'
import { Team } from '../team.js'
import type { TeamID } from '../team-id.js'

export class TeamConcurrencyError extends EntityConcurrencyError<TeamID> {
  public constructor(id: TeamID) {
    super(Team.name, id)
  }
}
