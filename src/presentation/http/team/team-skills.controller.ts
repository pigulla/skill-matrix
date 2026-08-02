import {
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

import { ITeamSkillProficienciesService } from '#/application/team/team-skill-proficiencies.service.interface.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import type { TeamID } from '#/domain/team/team-id.js'

import { fromDomain, SetSkillProficiencyDTO, TeamSkillProficienciesDTO } from './team-skill.dto.js'

@Controller('teams/:teamId/skills')
@ApiTags('Team Skills')
@ApiParam({ name: 'teamId', type: 'string', format: 'uuid' })
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description: 'A route parameter or payload was malformed and did not pass validation.',
})
@ApiResponse({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  description: 'An internal server error occurred.',
})
export class TeamSkillsController {
  private readonly service: ITeamSkillProficienciesService

  public constructor(service: ITeamSkillProficienciesService) {
    this.service = service
  }

  @Get()
  @ApiOperation({ summary: 'Get skill proficiencies for a team.' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TeamSkillProficienciesDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The team was not found.' })
  public async get(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
  ): Promise<TeamSkillProficienciesDTO> {
    return fromDomain(await this.service.get({ teamId }))
  }

  @Post(':skillId')
  @ApiOperation({ summary: 'Add a skill proficiency to a team.' })
  @ApiParam({ name: 'skillId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: TeamSkillProficienciesDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The skill is already associated with the team.',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The referenced skill or team was not found.',
  })
  public async add(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
    @Param('skillId', new ParseUUIDPipe({ version: '4' }))
    skillId: SkillID,
    @Body() dto: SetSkillProficiencyDTO,
  ): Promise<TeamSkillProficienciesDTO> {
    return fromDomain(await this.service.add({ teamId, skillId, proficiency: dto.proficiency }))
  }

  @Put(':skillId')
  @ApiOperation({ summary: 'Update a skill proficiency on a team.' })
  @ApiParam({ name: 'skillId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TeamSkillProficienciesDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team or skill association was not found.',
  })
  public async update(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
    @Param('skillId', new ParseUUIDPipe({ version: '4' }))
    skillId: SkillID,
    @Body() dto: SetSkillProficiencyDTO,
  ): Promise<TeamSkillProficienciesDTO> {
    return fromDomain(await this.service.update({ teamId, skillId, proficiency: dto.proficiency }))
  }

  @Delete(':skillId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a skill proficiency from a team.' })
  @ApiParam({ name: 'skillId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TeamSkillProficienciesDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team or skill association was not found.',
  })
  public async remove(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
    @Param('skillId', new ParseUUIDPipe({ version: '4' }))
    skillId: SkillID,
  ): Promise<TeamSkillProficienciesDTO> {
    return fromDomain(await this.service.remove({ teamId, skillId }))
  }
}
