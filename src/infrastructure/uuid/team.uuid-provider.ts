import { Injectable } from '@nestjs/common'

import type { ITeamUuidProvider } from '#/application/team/team-uuid-provider.interface.js'
import { IUuidGenerator } from '#/application/uuid-generator.interface.js'
import { type TeamID, teamIdSchema } from '#/domain/team/team-id.js'

@Injectable()
export class TeamUuidProvider implements ITeamUuidProvider {
  private readonly uuidGenerator: IUuidGenerator

  public constructor(uuidGenerator: IUuidGenerator) {
    this.uuidGenerator = uuidGenerator
  }

  public generate(): TeamID {
    return teamIdSchema.parse(this.uuidGenerator.generate())
  }
}
