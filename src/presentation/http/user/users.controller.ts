import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common'
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'

import { IUserService } from '#/application/user/user.service.interface.js'
import type { UserID } from '#/domain/user/user-id.js'

import { AssignTeamDTO, CreateUserDTO, fromDomain, UpdateUserDTO, UserDTO } from './user.dto.js'

@Controller('users')
@ApiTags('Users')
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description:
    'A query or route parameter, the payload or a header was malformed and did not pass validation.',
})
@ApiResponse({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  description: 'An internal server error occurred.',
})
export class UsersController {
  private readonly service: IUserService

  public constructor(service: IUserService) {
    this.service = service
  }

  @Get()
  @ApiOperation({
    summary: 'Get all users.',
    description: 'Get all users.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [UserDTO],
    description: 'The operation completed successfully.',
  })
  public async getAll(): Promise<UserDTO[]> {
    const users = await this.service.getAll()

    return users.map(user => fromDomain(user))
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a user.',
    description: 'Get the user with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: UserDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The user with the given id was not found.',
  })
  public async getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: UserID,
  ): Promise<UserDTO> {
    return fromDomain(await this.service.get(id))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user.',
    description: 'Delete the user with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The user with the given id was not found.',
  })
  public async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: UserID,
  ): Promise<void> {
    await this.service.delete(id)
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new user.',
    description: 'Create a new user and return it.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The operation completed successfully.',
    type: UserDTO,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The referenced team was not found.',
  })
  public async create(@Body() dto: CreateUserDTO): Promise<UserDTO> {
    const result = await this.service.create(dto)

    return fromDomain(result)
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({
    summary: 'Update an existing user.',
    description: 'Update an existing user, if it exists, and return it.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The operation completed successfully.',
    type: UserDTO,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The user with the given id was not found.',
  })
  public async update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: UserID,
    @Body() dto: UpdateUserDTO,
  ): Promise<UserDTO> {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    const result = await this.service.update({
      id,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
    })

    return fromDomain(result)
  }

  @Put(':id/team')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({
    summary: 'Assign a user to a team.',
    description: 'Move the user with the given id to the given team.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: UserDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The user with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The referenced team was not found.',
  })
  public async assignTeam(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: UserID,
    @Body() dto: AssignTeamDTO,
  ): Promise<UserDTO> {
    const result = await this.service.assignTeam(id, dto.teamId)

    return fromDomain(result)
  }
}
