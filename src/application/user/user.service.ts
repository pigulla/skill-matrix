import { Injectable } from '@nestjs/common'
import { Transactional } from '@nestjs-cls/transactional'

import type { TeamID } from '#/domain/team/team-id.js'
import { User } from '#/domain/user/user.js'
import { IUserRepository } from '#/domain/user/user.repository.interface.js'
import { type UserID } from '#/domain/user/user-id.js'

import { IUserService } from './user.service.interface.js'
import { IUserUuidProvider } from './user-uuid-provider.interface.js'

@Injectable()
export class UserService implements IUserService {
  private readonly userRepository: IUserRepository
  private readonly uuidProvider: IUserUuidProvider

  public constructor(userRepository: IUserRepository, uuidProvider: IUserUuidProvider) {
    this.userRepository = userRepository
    this.uuidProvider = uuidProvider
  }

  @Transactional()
  public getAll(): Promise<User[]> {
    return this.userRepository.getAll()
  }

  @Transactional()
  public get(id: UserID): Promise<User> {
    return this.userRepository.get(id)
  }

  @Transactional()
  public delete(id: UserID): Promise<void> {
    return this.userRepository.delete(id)
  }

  @Transactional()
  public create(data: {
    firstName: string
    lastName: string
    email: string
    teamId: TeamID
  }): Promise<User> {
    const id = this.uuidProvider.generate()
    const user = new User({ ...data, id })

    return this.userRepository.create(user)
  }

  @Transactional()
  public async update(data: {
    id: UserID
    firstName: string
    lastName: string
    email: string
  }): Promise<User> {
    const existing = await this.userRepository.get(data.id)

    return this.userRepository.update(existing.update(data))
  }

  @Transactional()
  public assignTeam(userId: UserID, teamId: TeamID): Promise<User> {
    return this.userRepository.assignTeam(userId, teamId)
  }
}
