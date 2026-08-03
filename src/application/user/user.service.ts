import { Injectable } from '@nestjs/common'
import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import type { DuplicateUserEmailError } from '#/domain/user/error/duplicate-user-email.error.js'
import type { DuplicateUserIdError } from '#/domain/user/error/duplicate-user-id.error.js'
import type { UserNotFoundError } from '#/domain/user/error/user-not-found.error.js'
import { type Properties, User } from '#/domain/user/user.js'
import { IUserRepository } from '#/domain/user/user.repository.interface.js'
import type { UserID } from '#/domain/user/user-id.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

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

  @ResultTransactional()
  public getAll(): ResultAsync<User[], never> {
    return this.userRepository.getAll()
  }

  @ResultTransactional()
  public get(id: UserID): ResultAsync<User, UserNotFoundError> {
    return this.userRepository.get(id)
  }

  @ResultTransactional()
  public delete(id: UserID): ResultAsync<void, UserNotFoundError> {
    return this.userRepository.delete(id)
  }

  @ResultTransactional()
  public create(
    data: Except<Properties, 'id'>,
  ): ResultAsync<
    User,
    DuplicateUserIdError | DuplicateUserEmailError | TeamReferenceNotFoundError
  > {
    const id = this.uuidProvider.generate()
    const user = new User({ ...data, id })

    return this.userRepository.create(user)
  }

  @ResultTransactional()
  public update(
    data: SetRequired<Partial<Properties>, 'id'>,
  ): ResultAsync<User, UserNotFoundError | DuplicateUserEmailError | TeamReferenceNotFoundError> {
    return this.userRepository
      .get(data.id)
      .andThen(existing => this.userRepository.update(existing.update(data)))
  }
}
