import type { ResultAsync } from 'neverthrow'

import type { ExampleReferenceNotFoundError } from '../example/error/example-reference-not-found.error.js'

import type { DuplicateSkillIdError } from './error/duplicate-skill-id.error.js'
import type { DuplicateSkillNameError } from './error/duplicate-skill-name.error.js'
import type { SkillInUseError } from './error/skill-in-use.error.js'
import type { SkillNotFoundError } from './error/skill-not-found.error.js'
import type { Skill } from './skill.js'
import type { SkillID } from './skill-id.js'

export abstract class ISkillRepository {
  public abstract create(
    skill: Skill,
  ): ResultAsync<
    Skill,
    DuplicateSkillIdError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  >
  public abstract get(id: SkillID): ResultAsync<Skill, SkillNotFoundError>
  public abstract getAll(): ResultAsync<Skill[], never>
  public abstract update(
    skill: Skill,
  ): ResultAsync<
    Skill,
    SkillNotFoundError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  >
  public abstract delete(id: SkillID): ResultAsync<void, SkillInUseError | SkillNotFoundError>
}
