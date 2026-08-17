import { createZodDto } from 'nestjs-zod'

import { User, userSchema } from '#/domain/user/user.js'

const createUserDTOSchema = userSchema
  .pick({
    email: true,
    firstName: true,
    lastName: true,
    teamId: true,
  })
  .strict()
  .brand('create-user-dto')

const updateUserDTOSchema = userSchema
  .pick({
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    teamId: true,
  })
  .strict()
  .brand('update-user-dto')

const userDTOSchema = updateUserDTOSchema.brand('user-dto')

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
