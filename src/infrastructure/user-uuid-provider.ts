import type { IUserUuidProvider } from '#/application/user/user-uuid-provider.interface.js'
import { EntityIdMarker } from '#/domain/id-markers.js'
import { type UserID, userIdSchema } from '#/domain/user/user-id.js'

import { UuidProvider } from './uuid-provider.js'

export class UserUuidProvider extends UuidProvider<UserID> implements IUserUuidProvider {
  public constructor() {
    super(EntityIdMarker.USER, userIdSchema)
  }
}
