import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import type { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import type { TeamNotEmptyError } from '#/domain/team/error/team-not-empty.error.js'
import type { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import type { Properties, Team } from '#/domain/team/team.js'
import type { TeamID } from '#/domain/team/team-id.js'

export abstract class ITeamService {
  public abstract create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<Team, DuplicateTeamIdError | DuplicateTeamNameError>
  public abstract delete(id: TeamID): ResultAsync<void, TeamNotFoundError | TeamNotEmptyError>
  public abstract get(id: TeamID): ResultAsync<Team, TeamNotFoundError>
  public abstract getAll(): ResultAsync<Team[], never>
  public abstract update(
    properties: SetRequired<Partial<Properties>, 'id'>,
  ): ResultAsync<Team, TeamNotFoundError | DuplicateTeamNameError>
}
