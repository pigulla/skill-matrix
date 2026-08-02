import { Injectable } from '@nestjs/common'
import { Transactional } from '@nestjs-cls/transactional'

import { Team } from '#/domain/team/team.js'
import { ITeamRepository } from '#/domain/team/team.repository.interface.js'
import { type TeamID } from '#/domain/team/team-id.js'

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

  @Transactional()
  public getAll(): Promise<Team[]> {
    return this.teamRepository.getAll()
  }

  @Transactional()
  public get(id: TeamID): Promise<Team> {
    return this.teamRepository.get(id)
  }

  @Transactional()
  public delete(id: TeamID): Promise<void> {
    return this.teamRepository.delete(id)
  }

  @Transactional()
  public create(data: { name: string }): Promise<Team> {
    const id = this.uuidProvider.generate()
    const team = new Team({ ...data, id })

    return this.teamRepository.create(team)
  }

  @Transactional()
  public update(team: Team): Promise<Team> {
    return this.teamRepository.update(team)
  }
}
