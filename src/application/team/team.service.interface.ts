import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import type { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import type { TeamConcurrencyError } from '#/domain/team/error/team-concurrency.error.js'
import type { TeamNotEmptyError } from '#/domain/team/error/team-not-empty.error.js'
import type { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import type { Properties, Team } from '#/domain/team/team.js'
import type { TeamID } from '#/domain/team/team-id.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'

export abstract class ITeamService {
  public abstract create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<WithConcurrencyToken<Team>, DuplicateTeamIdError | DuplicateTeamNameError>
  public abstract delete(
    id: TeamID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<void, TeamNotFoundError | TeamNotEmptyError | TeamConcurrencyError>
  public abstract get(id: TeamID): ResultAsync<WithConcurrencyToken<Team>, TeamNotFoundError>
  public abstract getAll(): ResultAsync<Team[], never>
  public abstract update(
    properties: SetRequired<Partial<Properties>, 'id'>,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Team>,
    TeamNotFoundError | DuplicateTeamNameError | TeamConcurrencyError
  >
}
