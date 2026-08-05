import type { ISkillUuidProvider } from '#/application/skill/skill-uuid-provider.interface.js'
import { EntityIdMarker } from '#/domain/id-markers.js'
import { type SkillID, skillIdSchema } from '#/domain/skill/skill-id.js'

import { UuidProvider } from './uuid-provider.js'

export class SkillUuidProvider extends UuidProvider<SkillID> implements ISkillUuidProvider {
  public constructor() {
    super(EntityIdMarker.SKILL, skillIdSchema)
  }
}
