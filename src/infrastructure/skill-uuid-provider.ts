import { EntityIdMarker } from '#/domain/id-markers.js'
import { type SkillID, skillIdSchema } from '#/domain/skill/skill-id.js'

import { UuidProvider } from './uuid-provider.js'

export class SkillUuidProvider extends UuidProvider<SkillID> {
  public constructor() {
    super(EntityIdMarker.SKILL, skillIdSchema)
  }
}
