import { Injectable } from '@nestjs/common'

import type { IUserUuidProvider } from '#/application/user/user-uuid-provider.interface.js'
import { IUuidGenerator } from '#/application/uuid-generator.interface.js'
import { type UserID, userIdSchema } from '#/domain/user/user-id.js'

@Injectable()
export class UserUuidProvider implements IUserUuidProvider {
  private readonly uuidGenerator: IUuidGenerator

  public constructor(uuidGenerator: IUuidGenerator) {
    this.uuidGenerator = uuidGenerator
  }

  public generate(): UserID {
    return userIdSchema.parse(this.uuidGenerator.generate())
  }
}
