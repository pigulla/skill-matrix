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

import { ISkillService } from '#/application/skill/skill.service.interface.js'
import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { ExampleReferenceNotFoundError } from '#/domain/example/error/example-reference-not-found.error.js'
import type { DuplicateSkillIdError } from '#/domain/skill/error/duplicate-skill-id.error.js'
import type { DuplicateSkillNameError } from '#/domain/skill/error/duplicate-skill-name.error.js'
import type { SkillConcurrencyError } from '#/domain/skill/error/skill-concurrency.error.js'
import type { SkillInUseError } from '#/domain/skill/error/skill-in-use.error.js'
import type { SkillNotFoundError } from '#/domain/skill/error/skill-not-found.error.js'
import { EXAMPLE_SKILL_ID, type SkillID } from '#/domain/skill/skill-id.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'
import { UnwrapResult } from '#/util/unwrap-result.decorator.js'

import { EXAMPLE_ETAG } from '../etag.js'
import { ETagResponse } from '../etag-response.decorator.js'
import { IfMatchHeader } from '../if-match-header.decorator.js'
import { OpenApiTag } from '../openapi.tag.js'

import { CreateSkillDTO, fromDomain, SkillDTO, UpdateSkillDTO } from './skill.dto.js'

@Controller('skills')
@ApiTags(OpenApiTag.SKILLS.name)
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description:
    'A query or route parameter, the payload or a header is missing,  malformed or did not pass validation.',
})
@ApiResponse({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  description: 'An internal server error occurred.',
})
export class SkillsController {
  private readonly service: ISkillService

  public constructor(service: ISkillService) {
    this.service = service
  }

  @Get()
  @ApiOperation({
    operationId: 'skill.getAll',
    summary: 'Get all skills.',
    description: 'Get all skills.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [SkillDTO],
    description: 'The operation completed successfully.',
  })
  @UnwrapResult()
  public getAll(): ResultAsync<SkillDTO[], never> {
    return this.service.getAll().map(skills => skills.map(fromDomain))
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'skill.getOne',
    summary: 'Get a skill.',
    description: 'Get the skill with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_SKILL_ID })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SkillDTO,
    description: 'The operation completed successfully.',
    headers: {
      ETag: {
        description: 'The skill’s current ETag .',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The skill with the given id was not found.',
  })
  @ETagResponse()
  @UnwrapResult()
  public getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: SkillID,
  ): ResultAsync<WithConcurrencyToken<SkillDTO>, SkillNotFoundError> {
    return this.service.get(id).map(({ value, token }) => ({ value: fromDomain(value), token }))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'skill.delete',
    summary: 'Delete a skill.',
    description: 'Delete the skill with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_SKILL_ID })
  @ApiHeader({
    name: 'If-Match',
    description: 'The skill’s current ETag .',
    required: true,
    example: EXAMPLE_ETAG,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The skill with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: `The skill is in use and can't be deleted.`,
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_FAILED,
    description: 'The If-Match header does not match the skill’s current ETag.',
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_REQUIRED,
    description: 'The If-Match header is missing.',
  })
  @UnwrapResult()
  public delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: SkillID,
    @IfMatchHeader() expectedToken: ConcurrencyToken,
  ): ResultAsync<void, SkillInUseError | SkillNotFoundError | SkillConcurrencyError> {
    return this.service.delete(id, expectedToken)
  }

  @Post()
  @ApiOperation({
    operationId: 'skill.create',
    summary: 'Create a new skill.',
    description: 'Create a new skill and return it.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: SkillDTO,
    description: 'The operation completed successfully.',
    headers: {
      ETag: {
        description: 'The skill’s current ETag .',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: `A uniqueness constraint on one of the skill's properties is being violated.`,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'A referenced example was not found.',
  })
  @ApiBody({ type: CreateSkillDTO })
  @ETagResponse()
  @UnwrapResult()
  public create(
    @Body() dto: CreateSkillDTO,
  ): ResultAsync<
    WithConcurrencyToken<SkillDTO>,
    DuplicateSkillIdError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  > {
    return this.service
      .create({
        name: dto.name,
        description: dto.description,
        exampleIds: new Set(dto.exampleIds),
      })
      .map(({ value, token }) => ({ value: fromDomain(value), token }))
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_SKILL_ID })
  @ApiOperation({
    operationId: 'skill.update',
    summary: 'Update an existing skill.',
    description: 'Update an existing skill, if it exists, and return it.',
  })
  @ApiHeader({
    name: 'If-Match',
    description: 'The skill’s current ETag .',
    required: true,
    example: EXAMPLE_ETAG,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The operation completed successfully.',
    type: SkillDTO,
    headers: {
      ETag: {
        description: 'The skill’s current ETag .',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The skill with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: `A uniqueness constraint on one of the skill's properties is being violated.`,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'A referenced example was not found.',
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_FAILED,
    description: 'The If-Match header does not match the skill’s current ETag.',
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_REQUIRED,
    description: 'The If-Match header is missing.',
  })
  @ApiBody({ type: UpdateSkillDTO })
  @ETagResponse()
  @UnwrapResult()
  public update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: SkillID,
    @Body() dto: UpdateSkillDTO,
    @IfMatchHeader() expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<SkillDTO>,
    | SkillNotFoundError
    | DuplicateSkillNameError
    | ExampleReferenceNotFoundError
    | SkillConcurrencyError
  > {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    return this.service
      .update({ ...dto, exampleIds: new Set(dto.exampleIds) }, expectedToken)
      .map(({ value, token }) => ({ value: fromDomain(value), token }))
  }
}
