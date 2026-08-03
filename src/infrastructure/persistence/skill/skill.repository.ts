import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ExampleReferenceNotFoundError } from '#/domain/example/error/example-reference-not-found.error.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import { DuplicateSkillIdError } from '#/domain/skill/error/duplicate-skill-id.error.js'
import { DuplicateSkillNameError } from '#/domain/skill/error/duplicate-skill-name.error.js'
import { SkillInUseError } from '#/domain/skill/error/skill-in-use.error.js'
import { SkillNotFoundError } from '#/domain/skill/error/skill-not-found.error.js'
import type { Skill } from '#/domain/skill/skill.js'
import { ISkillRepository } from '#/domain/skill/skill.repository.interface.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
import { isRestrictViolation } from '../error/is-restrict-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { QUERY } from './sql/queries.js'
import { skillWithExampleIdsRow } from './sql/skills.row.js'

const {
  ASSOCIATE_EXAMPLE_WITH_SKILL,
  DELETE_SKILL,
  DELETE_SKILL_EXAMPLES,
  GET_ALL_SKILLS,
  GET_SKILL,
  INSERT_SKILL,
  UPDATE_SKILL,
} = QUERY

@Injectable()
export class SkillRepository implements ISkillRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>

  public constructor(txHost: TransactionHost<TransactionalAdapterPgPromise>) {
    this.txHost = txHost
  }

  public get(id: SkillID): ResultAsync<Skill, SkillNotFoundError> {
    return ResultAsync.fromPromise(this.txHost.tx.oneOrNone<unknown>(GET_SKILL, { id }), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(row =>
      row === null
        ? errAsync(new SkillNotFoundError(id))
        : okAsync(skillWithExampleIdsRow.parse(row).toDomain()),
    )
  }

  public getAll(): ResultAsync<Skill[], never> {
    return ResultAsync.fromPromise(this.txHost.tx.manyOrNone<unknown>(GET_ALL_SKILLS), error => {
      throw new UnexpectedPersistenceError(error as Error)
    }).map(rows => rows.map(row => skillWithExampleIdsRow.parse(row).toDomain()))
  }

  @ResultTransactional()
  public create(
    skill: Skill,
  ): ResultAsync<
    Skill,
    DuplicateSkillIdError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  > {
    const { id, name, description, exampleIds } = skill
    const self = this

    async function createAndFetch(): Promise<Skill> {
      await self.txHost.tx.one<unknown>(INSERT_SKILL, { id, name, description })
      await self.updateAssociations(id, exampleIds)

      const row = await self.txHost.tx.one<unknown>(GET_SKILL, { id })

      return skillWithExampleIdsRow.parse(row).toDomain()
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
  ): ResultAsync<
    Skill,
    SkillNotFoundError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  > {
    const { id, name, description, exampleIds } = skill
    const self = this

    async function updateRow(): Promise<boolean> {
      const row = await self.txHost.tx.oneOrNone<unknown>(UPDATE_SKILL, { id, name, description })

      if (row === null) {
        return false
      }

      await self.updateAssociations(id, exampleIds)

      return true
    }

    return ResultAsync.fromPromise(updateRow(), error => {
      if (error instanceof ExampleReferenceNotFoundError) {
        return error
      }
      if (error instanceof UnexpectedPersistenceError) {
        throw error
      }
      if (isUniqueConstraintViolation('skills_name', error)) {
        return new DuplicateSkillNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }).andThen(updated => (updated ? self.get(id) : errAsync(new SkillNotFoundError(id))))
  }

  private async updateAssociations(
    skillId: SkillID,
    exampleIds: ReadonlySet<ExampleID>,
  ): Promise<void> {
    try {
      await this.txHost.tx.none(DELETE_SKILL_EXAMPLES, { skill_id: skillId })
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

  public delete(id: SkillID): ResultAsync<void, SkillInUseError | SkillNotFoundError> {
    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(DELETE_SKILL, { id }),
      error => {
        if (isRestrictViolation('skills_to_teams_skill_fkey', error)) {
          return new SkillInUseError(id)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row => (row === null ? errAsync(new SkillNotFoundError(id)) : okAsync(undefined)))
  }
}
