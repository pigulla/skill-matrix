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
import { ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { ResultAsync } from 'neverthrow'

import { ITeamService } from '#/application/team/team.service.interface.js'
import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { DuplicateTeamIdError } from '#/domain/team/error/duplicate-team-id.error.js'
import type { DuplicateTeamNameError } from '#/domain/team/error/duplicate-team-name.error.js'
import type { TeamConcurrencyError } from '#/domain/team/error/team-concurrency.error.js'
import type { TeamInUseError } from '#/domain/team/error/team-in-use.error.js'
import type { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { EXAMPLE_TEAM_ID, type TeamID } from '#/domain/team/team-id.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'
import { UnwrapResult } from '#/util/unwrap-result.decorator.js'

import { EXAMPLE_ETAG } from '../etag.js'
import { ETagResponse } from '../etag-response.decorator.js'
import { IfMatchHeader } from '../if-match-header.decorator.js'
import { OpenApiTag } from '../openapi.tag.js'

import { CreateTeamDTO, fromDomain, TeamDTO, UpdateTeamDTO } from './team.dto.js'

@Controller('teams')
@ApiTags(OpenApiTag.TEAMS.name)
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
    operationId: 'team.getAll',
    summary: 'Get all teams.',
    description: 'Get all teams.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [TeamDTO],
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The read conflicted with another transaction running at the same time.',
    examples: {
      transactionConflict: {
        summary: 'The read conflicted with a concurrent transaction',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message:
            'The transaction was rolled back because it conflicted with another one running at the same time. Retrying the request may succeed.',
        },
      },
    },
  })
  @UnwrapResult()
  public getAll(): ResultAsync<TeamDTO[], never> {
    return this.service.getAll().map(teams => teams.map(fromDomain))
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'team.getOne',
    summary: 'Get a team.',
    description: 'Get the team with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_TEAM_ID })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TeamDTO,
    description: 'The operation completed successfully.',
    headers: {
      ETag: {
        description: 'The team’s current ETag.',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The read conflicted with another transaction running at the same time.',
    examples: {
      transactionConflict: {
        summary: 'The read conflicted with a concurrent transaction',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message:
            'The transaction was rolled back because it conflicted with another one running at the same time. Retrying the request may succeed.',
        },
      },
    },
  })
  @ETagResponse()
  @UnwrapResult()
  public getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: TeamID,
  ): ResultAsync<WithConcurrencyToken<TeamDTO>, TeamNotFoundError> {
    return this.service.get(id).map(({ value, token }) => ({ value: fromDomain(value), token }))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'team.delete',
    summary: 'Delete a team.',
    description: 'Delete the team with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_TEAM_ID })
  @ApiHeader({
    name: 'If-Match',
    description: 'The team’s current ETag.',
    required: true,
    example: EXAMPLE_ETAG,
  })
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
    description:
      'The team still has members and cannot be deleted, or the write conflicted with another one running at the same time.',
    examples: {
      inUse: {
        summary: 'The team still has members and cannot be deleted',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message: 'The team still has members and cannot be deleted.',
        },
      },
      transactionConflict: {
        summary: 'The write conflicted with a concurrent transaction',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message:
            'The transaction was rolled back because it conflicted with another one running at the same time. Retrying the request may succeed.',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_FAILED,
    description: 'The If-Match header does not match the team’s current ETag.',
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_REQUIRED,
    description: 'The If-Match header is missing.',
  })
  @UnwrapResult()
  public delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: TeamID,
    @IfMatchHeader() expectedToken: ConcurrencyToken,
  ): ResultAsync<void, TeamNotFoundError | TeamInUseError | TeamConcurrencyError> {
    return this.service.delete(id, expectedToken)
  }

  @Post()
  @ApiOperation({
    operationId: 'team.create',
    summary: 'Create a new team.',
    description: 'Create a new team and return it.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The operation completed successfully.',
    type: TeamDTO,
    headers: {
      ETag: {
        description: 'The team’s current ETag.',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'A team with the given name already exists, or the write conflicted with another one running at the same time.',
    examples: {
      duplicateName: {
        summary: 'A team with this name already exists',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message: 'A team with this name already exists.',
        },
      },
      transactionConflict: {
        summary: 'The write conflicted with a concurrent transaction',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message:
            'The transaction was rolled back because it conflicted with another one running at the same time. Retrying the request may succeed.',
        },
      },
    },
  })
  @ApiBody({ type: CreateTeamDTO })
  @ETagResponse()
  @UnwrapResult()
  public create(
    @Body() dto: CreateTeamDTO,
  ): ResultAsync<WithConcurrencyToken<TeamDTO>, DuplicateTeamIdError | DuplicateTeamNameError> {
    return this.service.create(dto).map(({ value, token }) => ({ value: fromDomain(value), token }))
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_TEAM_ID })
  @ApiOperation({
    operationId: 'team.update',
    summary: 'Update an existing team.',
    description: 'Update an existing team, if it exists, and return it.',
  })
  @ApiHeader({
    name: 'If-Match',
    description: 'The team’s current ETag.',
    required: true,
    example: EXAMPLE_ETAG,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The operation completed successfully.',
    type: TeamDTO,
    headers: {
      ETag: {
        description: 'The team’s current ETag.',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The team with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'A team with the given name already exists, or the write conflicted with another one running at the same time.',
    examples: {
      duplicateName: {
        summary: 'A team with this name already exists',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message: 'A team with this name already exists.',
        },
      },
      transactionConflict: {
        summary: 'The write conflicted with a concurrent transaction',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message:
            'The transaction was rolled back because it conflicted with another one running at the same time. Retrying the request may succeed.',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_FAILED,
    description: 'The If-Match header does not match the team’s current ETag.',
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_REQUIRED,
    description: 'The If-Match header is missing.',
  })
  @ApiBody({ type: UpdateTeamDTO })
  @ETagResponse()
  @UnwrapResult()
  public update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: TeamID,
    @Body() dto: UpdateTeamDTO,
    @IfMatchHeader() expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<TeamDTO>,
    TeamNotFoundError | DuplicateTeamNameError | TeamConcurrencyError
  > {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    return this.service
      .update(dto, expectedToken)
      .map(({ value, token }) => ({ value: fromDomain(value), token }))
  }
}
