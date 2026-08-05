import type { ITeamUuidProvider } from '#/application/team/team-uuid-provider.interface.js'
import { EntityIdMarker } from '#/domain/id-markers.js'
import { type TeamID, teamIdSchema } from '#/domain/team/team-id.js'

import { UuidProvider } from './uuid-provider.js'

export class TeamUuidProvider extends UuidProvider<TeamID> implements ITeamUuidProvider {
  public constructor() {
    super(EntityIdMarker.TEAM, teamIdSchema)
  }
}
