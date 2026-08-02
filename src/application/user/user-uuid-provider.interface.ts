import type { UserID } from '#/domain/user/user-id.js'

import { IUuidProvider } from '../uuid-provider.interface.js'

export abstract class IUserUuidProvider extends IUuidProvider<UserID> {}
