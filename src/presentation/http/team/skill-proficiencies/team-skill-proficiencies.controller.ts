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

import { ITeamSkillProficienciesService } from '#/application/team/skill-proficiencies/team-skill-proficiencies.service.interface.js'
import { SkillNotFoundError } from '#/domain/skill/error/skill-not-found.error.js'
import { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import { EXAMPLE_SKILL_ID, type SkillID } from '#/domain/skill/skill-id.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import type { DuplicateTeamSkillProficienciesError } from '#/domain/team/skill-proficiencies/error/duplicate-team-skill-proficiencies.error.js'
import type { TeamSkillProficienciesNotFoundError } from '#/domain/team/skill-proficiencies/error/team-skill-proficiencies-not-found.error.js'
import { EXAMPLE_TEAM_ID, type TeamID } from '#/domain/team/team-id.js'
import { OpenApiTag } from '#/presentation/http/openapi.tag.js'
import {
  CreateSkillProficiencyDTO,
  UpdateSkillProficiencyDTO,
} from '#/presentation/http/skill/skill-proficiency.dto.js'
import { UnwrapResult } from '#/util/unwrap-result.decorator.js'

import { fromDomain, TeamSkillProficienciesDTO } from './team-skill-proficiencies.dto.js'

@Controller('teams/:teamId/skill-proficiencies')
@ApiTags(OpenApiTag.TEAM_SKILL_PROFICIENCIES.name)
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
export class TeamSkillProficienciesController {
  private readonly service: ITeamSkillProficienciesService

  public constructor(service: ITeamSkillProficienciesService) {
    this.service = service
  }

  @Get()
  @ApiOperation({
    operationId: 'team.skill-proficiencies.get',
    summary: 'Get skill proficiencies for a team.',
  })
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
  @ApiOperation({
    operationId: 'team.skill-proficiencies.add',
    summary: 'Add a skill proficiency to a team.',
  })
  @ApiParam({ name: 'skillId', type: 'string', format: 'uuid', example: EXAMPLE_SKILL_ID })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: TeamSkillProficienciesDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The team or skill was not found.' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The skill is already associated with the team.',
  })
  @ApiBody({ type: CreateSkillProficiencyDTO })
  @UnwrapResult()
  public add(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
    @Param('skillId', new ParseUUIDPipe({ version: '4' }))
    skillId: SkillID,
    @Body() dto: CreateSkillProficiencyDTO,
  ): ResultAsync<
    TeamSkillProficienciesDTO,
    DuplicateTeamSkillProficienciesError | TeamNotFoundError | SkillNotFoundError
  > {
    return this.service
      .add({ teamId, skillId, proficiency: dto.proficiency })
      .map(fromDomain)
      .mapErr(error => {
        // The default mapping would turn these errors into 422s, which isn't really correct for invalid route
        // parameters.
        if (error instanceof SkillReferenceNotFoundError) {
          return new SkillNotFoundError(error.id)
        }
        if (error instanceof TeamReferenceNotFoundError) {
          return new TeamNotFoundError(error.id)
        }
        return error
      })
  }

  @Put(':skillId')
  @ApiParam({ name: 'skillId', type: 'string', format: 'uuid', example: EXAMPLE_SKILL_ID })
  @ApiOperation({
    operationId: 'team.skill-proficiencies.update',
    summary: 'Update a skill proficiency on a team.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TeamSkillProficienciesDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team, skill, or the association between them was not found.',
  })
  @ApiBody({ type: UpdateSkillProficiencyDTO })
  @UnwrapResult()
  public update(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
    @Param('skillId', new ParseUUIDPipe({ version: '4' }))
    skillId: SkillID,
    @Body() dto: UpdateSkillProficiencyDTO,
  ): ResultAsync<
    TeamSkillProficienciesDTO,
    TeamSkillProficienciesNotFoundError | TeamNotFoundError
  > {
    return this.service.update({ ...dto, teamId, skillId }).map(fromDomain)
  }

  @Delete(':skillId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'team.skill-proficiencies.remove',
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
    description: 'The team, skill, or the association between them was not found.',
  })
  @UnwrapResult()
  public remove(
    @Param('teamId', new ParseUUIDPipe({ version: '4' }))
    teamId: TeamID,
    @Param('skillId', new ParseUUIDPipe({ version: '4' }))
    skillId: SkillID,
  ): ResultAsync<
    TeamSkillProficienciesDTO,
    TeamSkillProficienciesNotFoundError | TeamNotFoundError
  > {
    return this.service.remove({ teamId, skillId }).map(fromDomain)
  }
}
