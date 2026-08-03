import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { ExampleReferenceNotFoundError } from '#/domain/example/error/example-reference-not-found.error.js'
import type { DuplicateSkillIdError } from '#/domain/skill/error/duplicate-skill-id.error.js'
import type { DuplicateSkillNameError } from '#/domain/skill/error/duplicate-skill-name.error.js'
import type { SkillInUseError } from '#/domain/skill/error/skill-in-use.error.js'
import type { SkillNotFoundError } from '#/domain/skill/error/skill-not-found.error.js'
import type { Properties, Skill } from '#/domain/skill/skill.js'
import type { SkillID } from '#/domain/skill/skill-id.js'

export abstract class ISkillService {
  public abstract create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<
    Skill,
    DuplicateSkillIdError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  >
  public abstract delete(id: SkillID): ResultAsync<void, SkillInUseError | SkillNotFoundError>
  public abstract get(id: SkillID): ResultAsync<Skill, SkillNotFoundError>
  public abstract getAll(): ResultAsync<Skill[], never>
  public abstract update(
    properties: SetRequired<Partial<Properties>, 'id'>,
  ): ResultAsync<
    Skill,
    SkillNotFoundError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  >
}
