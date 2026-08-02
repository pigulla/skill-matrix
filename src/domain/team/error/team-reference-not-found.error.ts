import { EntityReferenceNotFoundError } from '../../error/entity-reference-not-found.error.js'
import type { TeamID } from '../team-id.js'

export class TeamReferenceNotFoundError extends EntityReferenceNotFoundError<TeamID> {
  public constructor(id: TeamID) {
    super('Team', id)
  }
}
