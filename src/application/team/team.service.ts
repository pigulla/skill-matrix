import { Injectable } from '@nestjs/common'
import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import type { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import type { TeamConcurrencyError } from '#/domain/team/error/team-concurrency.error.js'
import type { TeamInUseError } from '#/domain/team/error/team-in-use.error.js'
import type { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { type Properties, Team } from '#/domain/team/team.js'
import { ITeamRepository } from '#/domain/team/team.repository.interface.js'
import type { TeamID } from '#/domain/team/team-id.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

import { ITeamService } from './team.service.interface.js'
import { ITeamUuidProvider } from './team-uuid-provider.interface.js'

@Injectable()
export class TeamService implements ITeamService {
  private readonly teamRepository: ITeamRepository
  private readonly uuidProvider: ITeamUuidProvider

  public constructor(teamRepository: ITeamRepository, uuidProvider: ITeamUuidProvider) {
    this.teamRepository = teamRepository
    this.uuidProvider = uuidProvider
  }

  @ResultTransactional()
  public getAll(): ResultAsync<Team[], never> {
    return this.teamRepository.getAll()
  }

  @ResultTransactional()
  public get(id: TeamID): ResultAsync<WithConcurrencyToken<Team>, TeamNotFoundError> {
    return this.teamRepository.get(id)
  }

  @ResultTransactional()
  public create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<WithConcurrencyToken<Team>, DuplicateTeamIdError | DuplicateTeamNameError> {
    const id = this.uuidProvider.generate()
    const team = new Team({ ...properties, id })

    return this.teamRepository.create(team)
  }

  @ResultTransactional()
  public update(
    properties: SetRequired<Partial<Properties>, 'id'>,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Team>,
    TeamNotFoundError | DuplicateTeamNameError | TeamConcurrencyError
  > {
    return this.teamRepository
      .get(properties.id)
      .andThen(existing =>
        this.teamRepository.update(existing.value.update(properties), expectedToken),
      )
  }

  @ResultTransactional()
  public delete(
    id: TeamID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<void, TeamNotFoundError | TeamInUseError | TeamConcurrencyError> {
    return this.teamRepository.delete(id, expectedToken)
  }
}
