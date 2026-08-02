import type { SkillID } from '#/domain/skill/skill-id.js'

import { IUuidProvider } from '../uuid-provider.interface.js'

export abstract class ISkillUuidProvider extends IUuidProvider<SkillID> {}
