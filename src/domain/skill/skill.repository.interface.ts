import type { Skill } from './skill.js'
import type { SkillID } from './skill-id.js'

export abstract class ISkillRepository {
  public abstract delete(id: SkillID): Promise<void>

  public abstract getAll(): Promise<Skill[]>

  public abstract get(id: SkillID): Promise<Skill>

  public abstract create(skill: Skill): Promise<Skill>

  public abstract update(skill: Skill): Promise<Skill>
}
