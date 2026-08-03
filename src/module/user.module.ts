import { Module } from '@nestjs/common'

import { IUserService } from '#/application/user/user.service.interface.js'
import { UserService } from '#/application/user/user.service.js'
import { IUserUuidProvider } from '#/application/user/user-uuid-provider.interface.js'
import { IUserRepository } from '#/domain/user/user.repository.interface.js'
import { UserRepository } from '#/infrastructure/persistence/user/user.repository.js'
import { UserUuidProvider } from '#/infrastructure/user-uuid-provider.js'
import { UsersController } from '#/presentation/http/user/users.controller.js'

import { DatabaseModule } from './database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [
    { provide: IUserRepository, useClass: UserRepository },
    { provide: IUserService, useClass: UserService },
    { provide: IUserUuidProvider, useClass: UserUuidProvider },
  ],
})
export class UserModule {}
