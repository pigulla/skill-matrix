import type { ResultAsync } from 'neverthrow'

import type { ConcurrencyToken } from '../concurrency-token.js'
import type { ExampleReferenceNotFoundError } from '../example/error/example-reference-not-found.error.js'
import type { WithConcurrencyToken } from '../with-concurrency-token.js'

import type { DuplicateSkillIdError } from './error/duplicate-skill-id.error.js'
import type { DuplicateSkillNameError } from './error/duplicate-skill-name.error.js'
import type { SkillConcurrencyError } from './error/skill-concurrency.error.js'
import type { SkillInUseError } from './error/skill-in-use.error.js'
import type { SkillNotFoundError } from './error/skill-not-found.error.js'
import type { Skill } from './skill.js'
import type { SkillID } from './skill-id.js'

export abstract class ISkillRepository {
  public abstract getAll(): ResultAsync<Skill[], never>

  public abstract get(id: SkillID): ResultAsync<WithConcurrencyToken<Skill>, SkillNotFoundError>

  public abstract create(
    skill: Skill,
  ): ResultAsync<
    WithConcurrencyToken<Skill>,
    DuplicateSkillIdError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  >

  public abstract update(
    skill: Skill,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Skill>,
    | SkillNotFoundError
    | DuplicateSkillNameError
    | ExampleReferenceNotFoundError
    | SkillConcurrencyError
  >

  public abstract delete(
    id: SkillID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<void, SkillInUseError | SkillNotFoundError | SkillConcurrencyError>
}
