import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ITimeProvider } from '#/application/time-provider.interface.js'
import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import { ExampleReferenceNotFoundError } from '#/domain/example/error/example-reference-not-found.error.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import { DuplicateSkillIdError } from '#/domain/skill/error/duplicate-skill-id.error.js'
import { DuplicateSkillNameError } from '#/domain/skill/error/duplicate-skill-name.error.js'
import { SkillConcurrencyError } from '#/domain/skill/error/skill-concurrency.error.js'
import { SkillInUseError } from '#/domain/skill/error/skill-in-use.error.js'
import { SkillNotFoundError } from '#/domain/skill/error/skill-not-found.error.js'
import type { Skill } from '#/domain/skill/skill.js'
import { ISkillRepository } from '#/domain/skill/skill.repository.interface.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
import { isRestrictViolation } from '../error/is-restrict-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { QUERY } from './sql/queries.js'
import { skillDeleteRow, skillUpdateRow, skillWithExampleIdsRow } from './sql/skills.row.js'

const {
  ASSOCIATE_EXAMPLE_WITH_SKILL,
  DELETE,
  GET,
  GET_ALL,
  INSERT,
  UNASSOCIATE_ALL_EXAMPLES_FROM_SKILL,
  UPDATE,
} = QUERY

@Injectable()
export class SkillRepository implements ISkillRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>
  private readonly timeProvider: ITimeProvider

  public constructor(
    txHost: TransactionHost<TransactionalAdapterPgPromise>,
    timeProvider: ITimeProvider,
  ) {
    this.txHost = txHost
    this.timeProvider = timeProvider
  }

  public get(id: SkillID): ResultAsync<WithConcurrencyToken<Skill>, SkillNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row => {
      if (row === null) {
        return errAsync(new SkillNotFoundError(id))
      }

      const parsed = skillWithExampleIdsRow.parse(row)

      return okAsync({ value: parsed.toDomain(), token: parsed.getConcurrencyToken() })
    })
  }

  public getAll(): ResultAsync<Skill[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => skillWithExampleIdsRow.parse(row).toDomain()))
  }

  @ResultTransactional()
  public create(
    skill: Skill,
  ): ResultAsync<
    WithConcurrencyToken<Skill>,
    DuplicateSkillIdError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  > {
    const { id, name, description, exampleIds } = skill
    const lastUpdated = this.timeProvider.now().toDate()
    const self = this

    async function createAndFetch(): Promise<WithConcurrencyToken<Skill>> {
      await self.txHost.tx.one<unknown>(INSERT, { id, name, description, lastUpdated })
      await self.updateAssociations(id, exampleIds)

      const row = await self.txHost.tx.one<unknown>(GET, { id })
      const parsed = skillWithExampleIdsRow.parse(row)

      return { value: parsed.toDomain(), token: parsed.getConcurrencyToken() }
    }

    return ResultAsync.fromPromise(createAndFetch(), error => {
      if (error instanceof ExampleReferenceNotFoundError) {
        return error
      }
      if (error instanceof UnexpectedPersistenceError) {
        throw error
      }
      if (isUniqueConstraintViolation('skills_pkey', error)) {
        return new DuplicateSkillIdError(id)
      }
      if (isUniqueConstraintViolation('skills_name', error)) {
        return new DuplicateSkillNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    })
  }

  @ResultTransactional()
  public update(
    skill: Skill,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Skill>,
    | SkillNotFoundError
    | DuplicateSkillNameError
    | ExampleReferenceNotFoundError
    | SkillConcurrencyError
  > {
    const { id, name, description, exampleIds } = skill
    const lastUpdated = this.timeProvider.now().toDate()
    const self = this

    async function update(): Promise<void> {
      // oneOrNone yields: null (no such skill), { id: null } (stale token), or { id } (updated).
      const row = await self.txHost.tx.oneOrNone<unknown>(UPDATE, {
        id,
        name,
        description,
        lastUpdated,
        expectedToken,
      })

      if (row === null) {
        throw new SkillNotFoundError(id)
      }
      if (skillUpdateRow.parse(row).id === null) {
        throw new SkillConcurrencyError(id)
      }

      await self.updateAssociations(id, exampleIds)
    }

    return ResultAsync.fromPromise(update(), error => {
      if (
        error instanceof ExampleReferenceNotFoundError ||
        error instanceof SkillNotFoundError ||
        error instanceof SkillConcurrencyError
      ) {
        return error
      }
      if (error instanceof UnexpectedPersistenceError) {
        throw error
      }
      if (isUniqueConstraintViolation('skills_name', error)) {
        return new DuplicateSkillNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(() => self.get(id))
  }

  private async updateAssociations(
    skillId: SkillID,
    exampleIds: ReadonlySet<ExampleID>,
  ): Promise<void> {
    try {
      await this.txHost.tx.none(UNASSOCIATE_ALL_EXAMPLES_FROM_SKILL, { skill_id: skillId })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    await Promise.all(
      [...exampleIds].map(async exampleId => {
        try {
          await this.txHost.tx.none(ASSOCIATE_EXAMPLE_WITH_SKILL, {
            skill_id: skillId,
            example_id: exampleId,
          })
        } catch (error) {
          if (isForeignKeyViolation('examples_to_skills_example_fkey', error)) {
            throw new ExampleReferenceNotFoundError(exampleId)
          }

          throw new UnexpectedPersistenceError(error as Error)
        }
      }),
    )
  }

  public delete(
    id: SkillID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<void, SkillInUseError | SkillNotFoundError | SkillConcurrencyError> {
    // oneOrNone yields: null (no such skill), { id: null } (stale token), or { id } (deleted).
    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(DELETE, { id, expectedToken }),
      error => {
        if (isRestrictViolation('skills_to_teams_with_proficiency_skill_fkey', error)) {
          return new SkillInUseError(id)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row => {
      if (row === null) {
        return errAsync(new SkillNotFoundError(id))
      }

      return skillDeleteRow.parse(row).id === null
        ? errAsync(new SkillConcurrencyError(id))
        : okAsync(undefined)
    })
  }
}
