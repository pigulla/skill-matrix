import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { teamIdSchema } from '#/domain/team/team-id.js'
import { User, userSchema } from '#/domain/user/user.js'
import { userIdSchema } from '#/domain/user/user-id.js'

const baseUserFields = userSchema.pick({ email: true, firstName: true, lastName: true }).shape

const createUserDTOSchema = z
  .strictObject({ ...baseUserFields, teamId: teamIdSchema })
  .brand<'create-user-dto'>('create-user-dto')

const updateUserDTOSchema = z
  .strictObject({ ...baseUserFields, id: userIdSchema })
  .brand<'update-user-dto'>('update-user-dto')

const userDTOSchema = z
  .strictObject({ ...baseUserFields, id: userIdSchema, teamId: teamIdSchema })
  .brand<'user-dto'>('user-dto')

const assignTeamDTOSchema = z
  .strictObject({ teamId: teamIdSchema })
  .brand<'assign-team-dto'>('assign-team-dto')

export class CreateUserDTO extends createZodDto(createUserDTOSchema) {}

export class UpdateUserDTO extends createZodDto(updateUserDTOSchema) {}

export class UserDTO extends createZodDto(userDTOSchema) {}

export class AssignTeamDTO extends createZodDto(assignTeamDTOSchema) {}

export function fromDomain(user: User): UserDTO {
  return userDTOSchema.parse({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    teamId: user.teamId,
  })
}
