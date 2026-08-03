import type { ResultAsync } from 'neverthrow'

import type { DuplicateTeamIdError } from './error/duplicate-team-id.error.js'
import type { DuplicateTeamNameError } from './error/duplicate-team-name.error.js'
import type { TeamNotEmptyError } from './error/team-not-empty.error.js'
import type { TeamNotFoundError } from './error/team-not-found.error.js'
import type { Team } from './team.js'
import type { TeamID } from './team-id.js'

export abstract class ITeamRepository {
  public abstract create(
    team: Team,
  ): ResultAsync<Team, DuplicateTeamIdError | DuplicateTeamNameError>
  public abstract delete(id: TeamID): ResultAsync<void, TeamNotFoundError | TeamNotEmptyError>
  public abstract get(id: TeamID): ResultAsync<Team, TeamNotFoundError>
  public abstract getAll(): ResultAsync<Team[], never>
  public abstract update(team: Team): ResultAsync<Team, TeamNotFoundError | DuplicateTeamNameError>
}
