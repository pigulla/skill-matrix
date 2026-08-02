import { Injectable } from '@nestjs/common'
import { Transactional, TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'

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
import { isRestrictViolation } from '#/infrastructure/persistence/error/is-restrict-violation.js'

import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
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

  public async get(id: SkillID): Promise<Skill> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(GET_SKILL, { id })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new SkillNotFoundError(id)
    }

    return skillWithExampleIdsRow.parse(row).toDomain()
  }

  public async getAll(): Promise<Skill[]> {
    let rows: unknown[]

    try {
      rows = await this.txHost.tx.manyOrNone<unknown>(GET_ALL_SKILLS)
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    return rows.map(row => skillWithExampleIdsRow.parse(row).toDomain())
  }

  @Transactional()
  public async create(skill: Skill): Promise<Skill> {
    const { id, name, description, exampleIds } = skill

    try {
      await this.txHost.tx.one<unknown>(INSERT_SKILL, { id, name, description })
    } catch (error) {
      if (isUniqueConstraintViolation('skills_pkey', error)) {
        throw new DuplicateSkillIdError(id)
      }
      if (isUniqueConstraintViolation('skills_name', error)) {
        throw new DuplicateSkillNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    await this.updateAssociations(id, exampleIds)

    return this.get(id)
  }

  @Transactional()
  public async update(skill: Skill): Promise<Skill> {
    const { id, name, description, exampleIds } = skill

    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(UPDATE_SKILL, { id, name, description })
    } catch (error) {
      if (isUniqueConstraintViolation('skills_name', error)) {
        throw new DuplicateSkillNameError(name)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new SkillNotFoundError(id)
    }

    await this.updateAssociations(id, exampleIds)

    return this.get(id)
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

  public async delete(id: SkillID): Promise<void> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(DELETE_SKILL, { id })
    } catch (error) {
      if (isRestrictViolation('team_skills_skill_fkey', error)) {
        throw new SkillInUseError(id)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new SkillNotFoundError(id)
    }
  }
}
