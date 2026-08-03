import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { User, userSchema } from '#/domain/user/user.js'
import { userIdSchema } from '#/domain/user/user-id.js'

const baseUserFields = userSchema.pick({
  email: true,
  firstName: true,
  lastName: true,
  teamId: true,
}).shape

const createUserDTOSchema = z.strictObject({ ...baseUserFields }).brand('create-user-dto')

const updateUserDTOSchema = z
  .strictObject({ ...baseUserFields, id: userIdSchema })
  .brand('update-user-dto')

const userDTOSchema = z.strictObject({ ...baseUserFields, id: userIdSchema }).brand('user-dto')

export class CreateUserDTO extends createZodDto(createUserDTOSchema) {}

export class UpdateUserDTO extends createZodDto(updateUserDTOSchema) {}

export class UserDTO extends createZodDto(userDTOSchema) {}

export function fromDomain(user: User): UserDTO {
  return userDTOSchema.parse({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    teamId: user.teamId,
  })
}

export function toDomain(user: UserDTO | UpdateUserDTO): User {
  return new User(user)
}
