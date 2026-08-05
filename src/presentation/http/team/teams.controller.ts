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

import { ITeamService } from '#/application/team/team.service.interface.js'
import type { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import type { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import type { TeamNotEmptyError } from '#/domain/team/error/team-not-empty.error.js'
import type { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import type { TeamID } from '#/domain/team/team-id.js'
import { UnwrapResult } from '#/util/unwrap-result.decorator.js'

import { CreateTeamDTO, fromDomain, TeamDTO, UpdateTeamDTO } from './team.dto.js'

@Controller('teams')
@ApiTags('Teams')
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description:
    'A query or route parameter, the payload or a header is missing,  malformed or did not pass validation.',
})
@ApiResponse({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  description: 'An internal server error occurred.',
})
export class TeamsController {
  private readonly service: ITeamService

  public constructor(service: ITeamService) {
    this.service = service
  }

  @Get()
  @ApiOperation({
    operationId: 'teams.getAll',
    summary: 'Get all teams.',
    description: 'Get all teams.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [TeamDTO],
    description: 'The operation completed successfully.',
  })
  @UnwrapResult()
  public getAll(): ResultAsync<TeamDTO[], never> {
    return this.service.getAll().map(teams => teams.map(fromDomain))
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'teams.getOne',
    summary: 'Get a team.',
    description: 'Get the team with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TeamDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team with the given id was not found.',
  })
  @UnwrapResult()
  public getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: TeamID,
  ): ResultAsync<TeamDTO, TeamNotFoundError> {
    return this.service.get(id).map(fromDomain)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'teams.delete',
    summary: 'Delete a team.',
    description: 'Delete the team with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The team still has members and cannot be deleted.',
  })
  @UnwrapResult()
  public delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: TeamID,
  ): ResultAsync<void, TeamNotFoundError | TeamNotEmptyError> {
    return this.service.delete(id)
  }

  @Post()
  @ApiOperation({
    operationId: 'teams.create',
    summary: 'Create a new team.',
    description: 'Create a new team and return it.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The operation completed successfully.',
    type: TeamDTO,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A team with the given name already exists.',
  })
  @UnwrapResult()
  public create(
    @Body() dto: CreateTeamDTO,
  ): ResultAsync<TeamDTO, DuplicateTeamIdError | DuplicateTeamNameError> {
    return this.service.create(dto).map(fromDomain)
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({
    operationId: 'teams.update',
    summary: 'Update an existing team.',
    description: 'Update an existing team, if it exists, and return it.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The operation completed successfully.',
    type: TeamDTO,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A team with the given name already exists.',
  })
  @UnwrapResult()
  public update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: TeamID,
    @Body() dto: UpdateTeamDTO,
  ): ResultAsync<TeamDTO, TeamNotFoundError | DuplicateTeamNameError> {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    return this.service.update(dto).map(fromDomain)
  }
}
