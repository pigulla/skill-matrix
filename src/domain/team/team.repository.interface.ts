import type { ResultAsync } from 'neverthrow'

import type { ConcurrencyToken } from '../concurrency-token.js'
import type { WithConcurrencyToken } from '../with-concurrency-token.js'

import type { DuplicateTeamIdError } from './error/duplicate-team-id.error.js'
import type { DuplicateTeamNameError } from './error/duplicate-team-name.error.js'
import type { TeamConcurrencyError } from './error/team-concurrency.error.js'
import type { TeamNotEmptyError } from './error/team-not-empty.error.js'
import type { TeamNotFoundError } from './error/team-not-found.error.js'
import type { Team } from './team.js'
import type { TeamID } from './team-id.js'

export abstract class ITeamRepository {
  public abstract create(
    team: Team,
  ): ResultAsync<WithConcurrencyToken<Team>, DuplicateTeamIdError | DuplicateTeamNameError>
  public abstract delete(
    id: TeamID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<void, TeamNotFoundError | TeamNotEmptyError | TeamConcurrencyError>
  public abstract get(id: TeamID): ResultAsync<WithConcurrencyToken<Team>, TeamNotFoundError>
  public abstract getAll(): ResultAsync<Team[], never>
  public abstract update(
    team: Team,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Team>,
    TeamNotFoundError | DuplicateTeamNameError | TeamConcurrencyError
  >
}
