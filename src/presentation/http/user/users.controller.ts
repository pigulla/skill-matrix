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
import type { ResultAsync } from 'neverthrow'

import { IUserService } from '#/application/user/user.service.interface.js'
import type { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import type { DuplicateUserEmailError } from '#/domain/user/error/duplicate-user-email.error.js'
import type { DuplicateUserIdError } from '#/domain/user/error/duplicate-user-id.error.js'
import type { UserNotFoundError } from '#/domain/user/error/user-not-found.error.js'
import type { UserID } from '#/domain/user/user-id.js'
import { UnwrapResult } from '#/util/unwrap-result.decorator.js'

import { CreateUserDTO, fromDomain, toDomain, UpdateUserDTO, UserDTO } from './user.dto.js'

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
    operationId: 'users.getAll',
    summary: 'Get all users.',
    description: 'Get all users.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [UserDTO],
    description: 'The operation completed successfully.',
  })
  @UnwrapResult()
  public getAll(): ResultAsync<UserDTO[], never> {
    return this.service.getAll().map(users => users.map(fromDomain))
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'users.getOne',
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
  @UnwrapResult()
  public getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: UserID,
  ): ResultAsync<UserDTO, UserNotFoundError> {
    return this.service.get(id).map(fromDomain)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'users.delete',
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
  @UnwrapResult()
  public delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: UserID,
  ): ResultAsync<void, UserNotFoundError> {
    return this.service.delete(id)
  }

  @Post()
  @ApiOperation({
    operationId: 'users.create',
    summary: 'Create a new user.',
    description: 'Create a new user and return it.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The operation completed successfully.',
    type: UserDTO,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A user with an identical email address already exists.',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The referenced team was not found.',
  })
  @UnwrapResult()
  public create(
    @Body() dto: CreateUserDTO,
  ): ResultAsync<
    UserDTO,
    DuplicateUserIdError | DuplicateUserEmailError | TeamReferenceNotFoundError
  > {
    return this.service.create(dto).map(fromDomain)
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({
    operationId: 'users.update',
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
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The referenced team was not found.',
  })
  @UnwrapResult()
  public update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: UserID,
    @Body() dto: UpdateUserDTO,
  ): ResultAsync<
    UserDTO,
    UserNotFoundError | DuplicateUserEmailError | TeamReferenceNotFoundError
  > {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    return this.service.update(toDomain(dto)).map(fromDomain)
  }
}
