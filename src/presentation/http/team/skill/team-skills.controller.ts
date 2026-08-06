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
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { ResultAsync } from 'neverthrow'

import { ITeamSkillProficienciesService } from '#/application/team/team-skill-proficiencies.service.interface.js'
import type { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import { EXAMPLE_SKILL_ID, type SkillID } from '#/domain/skill/skill-id.js'
import type { DuplicateTeamSkillError } from '#/domain/team/error/duplicate-team-skill.error.js'
import type { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import type { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import type { TeamSkillNotFoundError } from '#/domain/team/error/team-skill-not-found.error.js'
import { EXAMPLE_TEAM_ID, type TeamID } from '#/domain/team/team-id.js'
import { UnwrapResult } from '#/util/unwrap-result.decorator.js'

import { fromDomain, SetSkillProficiencyDTO, TeamSkillProficienciesDTO } from './team-skill.dto.js'

@Controller('teams/:teamId/skills')
@ApiTags('Team Skills')
@ApiParam({ name: 'teamId', type: 'string', format: 'uuid', example: EXAMPLE_TEAM_ID })
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description:
    'A query or route parameter, the payload or a header is missing,  malformed or did not pass validation.',
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
  @ApiOperation({ operationId: 'team.skills.get', summary: 'Get skill proficiencies for a team.' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TeamSkillProficienciesDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The team was not found.' })
  @UnwrapResult()
  public get(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
  ): ResultAsync<TeamSkillProficienciesDTO, TeamNotFoundError> {
    return this.service.get({ teamId }).map(fromDomain)
  }

  @Post(':skillId')
  @ApiOperation({ operationId: 'team.skills.add', summary: 'Add a skill proficiency to a team.' })
  @ApiParam({ name: 'skillId', type: 'string', format: 'uuid', example: EXAMPLE_SKILL_ID })
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
  @ApiBody({ type: SetSkillProficiencyDTO })
  @UnwrapResult()
  public add(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
    @Param('skillId', new ParseUUIDPipe({ version: '4' }))
    skillId: SkillID,
    @Body() dto: SetSkillProficiencyDTO,
  ): ResultAsync<
    TeamSkillProficienciesDTO,
    | DuplicateTeamSkillError
    | SkillReferenceNotFoundError
    | TeamReferenceNotFoundError
    | TeamNotFoundError
  > {
    return this.service.add({ teamId, skillId, proficiency: dto.proficiency }).map(fromDomain)
  }

  @Put(':skillId')
  @ApiParam({ name: 'skillId', type: 'string', format: 'uuid', example: EXAMPLE_SKILL_ID })
  @ApiOperation({
    operationId: 'team.skills.update',
    summary: 'Update a skill proficiency on a team.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TeamSkillProficienciesDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team or skill association was not found.',
  })
  @ApiBody({ type: SetSkillProficiencyDTO })
  @UnwrapResult()
  public update(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
    @Param('skillId', new ParseUUIDPipe({ version: '4' }))
    skillId: SkillID,
    @Body() dto: SetSkillProficiencyDTO,
  ): ResultAsync<TeamSkillProficienciesDTO, TeamSkillNotFoundError | TeamNotFoundError> {
    return this.service.update({ ...dto, teamId, skillId }).map(fromDomain)
  }

  @Delete(':skillId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'team.skills.remove',
    summary: 'Remove a skill proficiency from a team.',
  })
  @ApiParam({ name: 'skillId', type: 'string', format: 'uuid', example: EXAMPLE_SKILL_ID })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TeamSkillProficienciesDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team or skill association was not found.',
  })
  @UnwrapResult()
  public remove(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
    @Param('skillId', new ParseUUIDPipe({ version: '4' }))
    skillId: SkillID,
  ): ResultAsync<TeamSkillProficienciesDTO, TeamSkillNotFoundError | TeamNotFoundError> {
    return this.service.remove({ teamId, skillId }).map(fromDomain)
  }
}
