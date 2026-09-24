import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common'
import { ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { ResultAsync } from 'neverthrow'

import { IExampleService } from '#/application/example/example.service.interface.js'
import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import type { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import type { ExampleConcurrencyError } from '#/domain/example/error/example-concurrency.error.js'
import type { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import type { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import { EXAMPLE_EXAMPLE_ID, type ExampleID, exampleIdSchema } from '#/domain/example/example-id.js'
import type { ExampleKindReferenceNotFoundError } from '#/domain/example/kind/error/example-kind-reference-not-found.error.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'
import { UnwrapResult } from '#/util/unwrap-result.decorator.js'

import { EXAMPLE_ETAG } from '../etag.js'
import { ETagResponse } from '../etag-response.decorator.js'
import { IdParam } from '../id-param.decorator.js'
import { IfMatchHeader } from '../if-match-header.decorator.js'
import { OpenApiTag } from '../openapi.tag.js'

import { CreateExampleDTO, ExampleDTO, fromDomain, UpdateExampleDTO } from './example.dto.js'

@Controller('examples')
@ApiTags(OpenApiTag.EXAMPLES.name)
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description:
    'A query or route parameter, the payload or a header is missing,  malformed or did not pass validation.',
})
@ApiResponse({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  description: 'An internal server error occurred.',
})
export class ExamplesController {
  private readonly service: IExampleService

  public constructor(service: IExampleService) {
    this.service = service
  }

  @Get()
  @ApiOperation({
    operationId: 'example.getAll',
    summary: 'Get all examples.',
    description: 'Get all examples.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [ExampleDTO],
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
  public getAll(): ResultAsync<ExampleDTO[], never> {
    return this.service.getAll().map(examples => examples.map(fromDomain))
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'example.getOne',
    summary: 'Get an example.',
    description: 'Get the example with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_EXAMPLE_ID })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ExampleDTO,
    description: 'The operation completed successfully.',
    headers: {
      ETag: {
        description: 'The example’s current ETag.',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The example with the given id was not found.',
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
    @IdParam('id', exampleIdSchema) id: ExampleID,
  ): ResultAsync<WithConcurrencyToken<ExampleDTO>, ExampleNotFoundError> {
    return this.service.get(id).map(({ value, token }) => ({ value: fromDomain(value), token }))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'example.delete',
    summary: 'Delete an example.',
    description: 'Delete the example with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_EXAMPLE_ID })
  @ApiHeader({
    name: 'If-Match',
    description: 'The example’s current ETag.',
    required: true,
    example: EXAMPLE_ETAG,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The example with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The example is still referenced by a skill, or the write conflicted with another one running at the same time.',
    examples: {
      inUse: {
        summary: 'The example is still referenced by a skill',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message: `Entity of type Example identified by (id=${EXAMPLE_EXAMPLE_ID}) is in use`,
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
    description: 'The If-Match header does not match the example’s current ETag.',
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_REQUIRED,
    description: 'The If-Match header is missing.',
  })
  @UnwrapResult()
  public delete(
    @IdParam('id', exampleIdSchema) id: ExampleID,
    @IfMatchHeader() expectedToken: ConcurrencyToken,
  ): ResultAsync<void, ExampleNotFoundError | ExampleInUseError | ExampleConcurrencyError> {
    return this.service.delete(id, expectedToken)
  }

  @Post()
  @ApiOperation({
    operationId: 'example.create',
    summary: 'Create a new example.',
    description: 'Create a new example and return it.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ExampleDTO,
    description: 'The operation completed successfully.',
    headers: {
      ETag: {
        description: 'The example’s current ETag.',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'An example with an identical name already exists, or the write conflicted with another one running at the same time.',
    examples: {
      duplicateName: {
        summary: 'An example with this name already exists',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message: 'Duplicate entity of type Example ((name=NestJS))',
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
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The referenced example kind does not exist.',
  })
  @ApiBody({ type: CreateExampleDTO })
  @ETagResponse()
  @UnwrapResult()
  public create(
    @Body() dto: CreateExampleDTO,
  ): ResultAsync<
    WithConcurrencyToken<ExampleDTO>,
    DuplicateExampleIdError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  > {
    return this.service.create(dto).map(({ value, token }) => ({ value: fromDomain(value), token }))
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_EXAMPLE_ID })
  @ApiOperation({
    operationId: 'example.update',
    summary: 'Update an existing example.',
    description: 'Update an existing example, if it exists, and return it.',
  })
  @ApiHeader({
    name: 'If-Match',
    description: 'The example’s current ETag.',
    required: true,
    example: EXAMPLE_ETAG,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ExampleDTO,
    description: 'The operation completed successfully.',
    headers: {
      ETag: {
        description: 'The example’s current ETag.',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The example with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'An example with an identical name already exists, or the write conflicted with another one running at the same time.',
    examples: {
      duplicateName: {
        summary: 'An example with this name already exists',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message: 'Duplicate entity of type Example ((name=NestJS))',
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
    description: 'The If-Match header does not match the example’s current ETag.',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The referenced example kind does not exist.',
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_REQUIRED,
    description: 'The If-Match header is missing.',
  })
  @ApiBody({ type: UpdateExampleDTO })
  @ETagResponse()
  @UnwrapResult()
  public update(
    @IdParam('id', exampleIdSchema) id: ExampleID,
    @Body() dto: UpdateExampleDTO,
    @IfMatchHeader() expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<ExampleDTO>,
    | ExampleNotFoundError
    | DuplicateExampleNameError
    | ExampleKindReferenceNotFoundError
    | ExampleConcurrencyError
  > {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    return this.service
      .update(dto, expectedToken)
      .map(({ value, token }) => ({ value: fromDomain(value), token }))
  }
}
