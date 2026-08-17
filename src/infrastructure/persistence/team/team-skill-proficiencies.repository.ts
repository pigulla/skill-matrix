import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import type { SkillProficiency } from '#/domain/skill/proficiency/skill-proficiency.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import { DuplicateTeamSkillProficienciesError } from '#/domain/team/skill-proficiencies/error/duplicate-team-skill-proficiencies.error.js'
import { TeamSkillProficienciesNotFoundError } from '#/domain/team/skill-proficiencies/error/team-skill-proficiencies-not-found.error.js'
import type { TeamSkillProficiencies } from '#/domain/team/skill-proficiencies/team-skill-proficiencies.js'
import { ITeamSkillProficienciesRepository } from '#/domain/team/skill-proficiencies/team-skill-proficiencies.repository.interface.js'
import type { TeamID } from '#/domain/team/team-id.js'

import { isForeignKeyViolation } from '../error/is-foreign-key-violation.js'
import { isUniqueConstraintViolation } from '../error/is-unique-constraint-violation.js'

import { QUERY } from './sql/queries.js'
import { teamSkillProficienciesRow } from './sql/team-skill-proficiencies.row.js'

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

  public get(teamId: TeamID): ResultAsync<TeamSkillProficiencies, TeamNotFoundError> {
    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(GET_TEAM_SKILL_PROFICIENCIES, { team_id: teamId }),
      error => {
        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row =>
      row === null
        ? errAsync(new TeamNotFoundError(teamId))
        : okAsync(teamSkillProficienciesRow.parse(row).toDomain()),
    )
  }

  public add(
    teamId: TeamID,
    proficiency: SkillProficiency,
  ): ResultAsync<
    void,
    DuplicateTeamSkillProficienciesError | SkillReferenceNotFoundError | TeamReferenceNotFoundError
  > {
    const { skillId } = proficiency

    return ResultAsync.fromPromise(
      this.txHost.tx.one<unknown>(INSERT_TEAM_SKILL_PROFICIENCY, {
        team_id: teamId,
        skill_id: skillId,
        proficiency: proficiency.proficiency,
      }),
      error => {
        if (isUniqueConstraintViolation('skills_to_teams_with_proficiency_pkey', error)) {
          return new DuplicateTeamSkillProficienciesError({ teamId, skillId })
        }
        if (isForeignKeyViolation('skills_to_teams_with_proficiency_skill_fkey', error)) {
          return new SkillReferenceNotFoundError(skillId)
        }
        if (isForeignKeyViolation('skills_to_teams_with_proficiency_team_fkey', error)) {
          return new TeamReferenceNotFoundError(teamId)
        }

        throw new UnexpectedPersistenceError(error as Error)
      },
    ).map(() => undefined)
  }

  public update(
    teamId: TeamID,
    proficiency: SkillProficiency,
  ): ResultAsync<void, TeamSkillProficienciesNotFoundError> {
    const { skillId } = proficiency

    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(UPDATE_TEAM_SKILL_PROFICIENCY, {
        team_id: teamId,
        skill_id: skillId,
        proficiency: proficiency.proficiency,
      }),
      error => {
        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row =>
      row === null
        ? errAsync(new TeamSkillProficienciesNotFoundError({ teamId, skillId }))
        : okAsync(undefined),
    )
  }

  public remove(
    teamId: TeamID,
    skillId: SkillID,
  ): ResultAsync<void, TeamSkillProficienciesNotFoundError> {
    return ResultAsync.fromPromise(
      this.txHost.tx.oneOrNone<unknown>(DELETE_TEAM_SKILL_PROFICIENCY, {
        team_id: teamId,
        skill_id: skillId,
      }),
      error => {
        throw new UnexpectedPersistenceError(error as Error)
      },
    ).andThen(row =>
      row === null
        ? errAsync(new TeamSkillProficienciesNotFoundError({ teamId, skillId }))
        : okAsync(undefined),
    )
  }
}
