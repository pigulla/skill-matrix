import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import { SkillProficiency } from '#/domain/skill/skill-proficiency.js'
import { DuplicateTeamSkillError } from '#/domain/team/error/duplicate-team-skill.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import { TeamSkillNotFoundError } from '#/domain/team/error/team-skill-not-found.error.js'
import type { TeamID } from '#/domain/team/team-id.js'
import { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'
import { ITeamSkillProficienciesRepository } from '#/domain/team/team-skill-proficiencies.repository.interface.js'

import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { QUERY } from './sql/queries.js'
import { teamSkillProficiencyRowSchema } from './sql/team-skill-proficiencies.row.js'

const {
  DELETE_TEAM_SKILL_PROFICIENCY,
  GET_TEAM_SKILL_PROFICIENCIES,
  INSERT_TEAM_SKILL_PROFICIENCY,
  UPDATE_TEAM_SKILL_PROFICIENCY,
} = QUERY

@Injectable()
export class TeamSkillProficienciesRepository implements ITeamSkillProficienciesRepository {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>

  public constructor(txHost: TransactionHost<TransactionalAdapterPgPromise>) {
    this.txHost = txHost
  }

  public async get(teamId: TeamID): Promise<TeamSkillProficiencies> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(GET_TEAM_SKILL_PROFICIENCIES, { teamId })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new TeamNotFoundError(teamId)
    }

    return teamSkillProficiencyRowSchema.parse(row).toDomain()
  }

  public async add(teamId: TeamID, proficiency: SkillProficiency): Promise<void> {
    const { skillId } = proficiency

    try {
      await this.txHost.tx.one<unknown>(INSERT_TEAM_SKILL_PROFICIENCY, {
        teamId,
        skillId,
        proficiency: proficiency.proficiency,
      })
    } catch (error) {
      if (isUniqueConstraintViolation('team_skills_pkey', error)) {
        throw new DuplicateTeamSkillError(teamId, skillId)
      }
      if (isForeignKeyViolation('team_skills_skill_fkey', error)) {
        throw new SkillReferenceNotFoundError(skillId)
      }
      if (isForeignKeyViolation('team_skills_team_fkey', error)) {
        throw new TeamReferenceNotFoundError(teamId)
      }

      throw new UnexpectedPersistenceError(error as Error)
    }
  }

  public async update(teamId: TeamID, proficiency: SkillProficiency): Promise<void> {
    const { skillId } = proficiency
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(UPDATE_TEAM_SKILL_PROFICIENCY, {
        teamId,
        skillId,
        proficiency: proficiency.proficiency,
      })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new TeamSkillNotFoundError(teamId, skillId)
    }
  }

  public async remove(teamId: TeamID, skillId: SkillID): Promise<void> {
    let row: unknown

    try {
      row = await this.txHost.tx.oneOrNone<unknown>(DELETE_TEAM_SKILL_PROFICIENCY, {
        teamId,
        skillId,
      })
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    if (row === null) {
      throw new TeamSkillNotFoundError(teamId, skillId)
    }
  }
}
