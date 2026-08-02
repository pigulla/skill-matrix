import type { TeamID } from '#/domain/team/team-id.js'

import { IUuidProvider } from '../uuid-provider.interface.js'

export abstract class ITeamUuidProvider extends IUuidProvider<TeamID> {}
