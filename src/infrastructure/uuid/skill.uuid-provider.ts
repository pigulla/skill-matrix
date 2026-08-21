import { Injectable } from '@nestjs/common'

import type { ISkillUuidProvider } from '#/application/skill/skill-uuid-provider.interface.js'
import { IUuidGenerator } from '#/application/uuid-generator.interface.js'
import { type SkillID, skillIdSchema } from '#/domain/skill/skill-id.js'

@Injectable()
export class SkillUuidProvider implements ISkillUuidProvider {
  private readonly uuidGenerator: IUuidGenerator

  public constructor(uuidGenerator: IUuidGenerator) {
    this.uuidGenerator = uuidGenerator
  }

  public generate(): SkillID {
    return skillIdSchema.parse(this.uuidGenerator.generate())
  }
}
