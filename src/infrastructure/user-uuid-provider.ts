import { EntityIdMarker } from '#/domain/id-markers.js'
import { type UserID, userIdSchema } from '#/domain/user/user-id.js'

import { UuidProvider } from './uuid-provider.js'

export class UserUuidProvider extends UuidProvider<UserID> {
  public constructor() {
    super(EntityIdMarker.USER, userIdSchema)
  }
}
