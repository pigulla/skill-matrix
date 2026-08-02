import { EntityIdMarker } from '#/domain/id-markers.js'
import { type TeamID, teamIdSchema } from '#/domain/team/team-id.js'

import { UuidProvider } from './uuid-provider.js'

export class TeamUuidProvider extends UuidProvider<TeamID> {
  public constructor() {
    super(EntityIdMarker.TEAM, teamIdSchema)
  }
}
