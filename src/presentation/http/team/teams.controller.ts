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

import { ITeamService } from '#/application/team/team.service.interface.js'
import type { TeamID } from '#/domain/team/team-id.js'

import { CreateTeamDTO, fromDomain, TeamDTO, toDomain, UpdateTeamDTO } from './team.dto.js'

@Controller('teams')
@ApiTags('Teams')
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description:
    'A query or route parameter, the payload or a header was malformed and did not pass validation.',
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
  @ApiOperation({ summary: 'Get all teams.', description: 'Get all teams.' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [TeamDTO],
    description: 'The operation completed successfully.',
  })
  public async getAll(): Promise<TeamDTO[]> {
    const teams = await this.service.getAll()

    return teams.map(team => fromDomain(team))
  }

  @Get(':id')
  @ApiOperation({
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
  public async getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: TeamID,
  ): Promise<TeamDTO> {
    return fromDomain(await this.service.get(id))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
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
  public async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: TeamID,
  ): Promise<void> {
    await this.service.delete(id)
  }

  @Post()
  @ApiOperation({ summary: 'Create a new team.', description: 'Create a new team and return it.' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The operation completed successfully.',
    type: TeamDTO,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A team with the given name already exists.',
  })
  public async create(@Body() dto: CreateTeamDTO): Promise<TeamDTO> {
    const result = await this.service.create(dto)

    return fromDomain(result)
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({
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
  public async update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: TeamID,
    @Body() dto: UpdateTeamDTO,
  ): Promise<TeamDTO> {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    const result = await this.service.update(toDomain(dto))

    return fromDomain(result)
  }
}
