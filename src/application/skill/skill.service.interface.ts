import type { Except } from 'type-fest'

import type { Properties, Skill } from '#/domain/skill/skill.js'
import type { SkillID } from '#/domain/skill/skill-id.js'

export abstract class ISkillService {
  public abstract create(properties: Except<Properties, 'id'>): Promise<Skill>
  public abstract update(properties: Properties): Promise<Skill>
  public abstract delete(id: SkillID): Promise<void>
  public abstract get(id: SkillID): Promise<Skill>
  public abstract getAll(): Promise<Skill[]>
}
