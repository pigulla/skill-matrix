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

import { IExampleKindService } from '#/application/example/kind/example-kind.service.interface.js'
import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { DuplicateExampleKindIdError } from '#/domain/example/kind/error/duplicate-example-kind-id.error.js'
import type { DuplicateExampleKindNameError } from '#/domain/example/kind/error/duplicate-example-kind-name.error.js'
import type { ExampleKindConcurrencyError } from '#/domain/example/kind/error/example-kind-concurrency.error.js'
import type { ExampleKindInUseError } from '#/domain/example/kind/error/example-kind-in-use.error.js'
import type { ExampleKindNotFoundError } from '#/domain/example/kind/error/example-kind-not-found.error.js'
import {
  EXAMPLE_EXAMPLE_KIND_ID,
  type ExampleKindID,
} from '#/domain/example/kind/example-kind-id.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'
import { UnwrapResult } from '#/util/unwrap-result.decorator.js'

import { EXAMPLE_ETAG } from '../../etag.js'
import { ETagResponse } from '../../etag-response.decorator.js'
import { IfMatchHeader } from '../../if-match-header.decorator.js'
import { OpenApiTag } from '../../openapi.tag.js'

import {
  CreateExampleKindDTO,
  ExampleKindDTO,
  fromDomain,
  UpdateExampleKindDTO,
} from './example-kind.dto.js'

@Controller('examples/kinds')
@ApiTags(OpenApiTag.EXAMPLE_KINDS.name)
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description:
    'A query or route parameter, the payload or a header is missing,  malformed or did not pass validation.',
})
@ApiResponse({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  description: 'An internal server error occurred.',
})
export class ExampleKindsController {
  private readonly service: IExampleKindService

  public constructor(service: IExampleKindService) {
    this.service = service
  }

  @Get()
  @ApiOperation({
    operationId: 'example.kind.getAll',
    summary: 'Get all example kinds.',
    description: 'Get all example kinds.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [ExampleKindDTO],
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
  public getAll(): ResultAsync<ExampleKindDTO[], never> {
    return this.service.getAll().map(exampleKinds => exampleKinds.map(fromDomain))
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'example.kind.getOne',
    summary: 'Get an example kind.',
    description: 'Get the example kind with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_EXAMPLE_KIND_ID })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ExampleKindDTO,
    description: 'The operation completed successfully.',
    headers: {
      ETag: {
        description: 'The example kind’s current ETag.',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The example kind with the given id was not found.',
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
    id: ExampleKindID,
  ): ResultAsync<WithConcurrencyToken<ExampleKindDTO>, ExampleKindNotFoundError> {
    return this.service.get(id).map(({ value, token }) => ({ value: fromDomain(value), token }))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'example.kind.delete',
    summary: 'Delete an example kind.',
    description: 'Delete the example kind with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_EXAMPLE_KIND_ID })
  @ApiHeader({
    name: 'If-Match',
    description: 'The example kind’s current ETag.',
    required: true,
    example: EXAMPLE_ETAG,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The example kind with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The example kind is still referenced by an example, or the write conflicted with another one running at the same time.',
    examples: {
      inUse: {
        summary: 'The example kind is still referenced by an example',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message: 'The example kind is still referenced by an example.',
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
    description: 'The If-Match header does not match the example kind’s current ETag.',
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_REQUIRED,
    description: 'The If-Match header is missing.',
  })
  @UnwrapResult()
  public delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: ExampleKindID,
    @IfMatchHeader() expectedToken: ConcurrencyToken,
  ): ResultAsync<
    void,
    ExampleKindNotFoundError | ExampleKindInUseError | ExampleKindConcurrencyError
  > {
    return this.service.delete(id, expectedToken)
  }

  @Post()
  @ApiOperation({
    operationId: 'example.kind.create',
    summary: 'Create a new example kind.',
    description: 'Create a new example kind and return it.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The operation completed successfully.',
    type: ExampleKindDTO,
    headers: {
      ETag: {
        description: 'The example kind’s current ETag.',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'An example kind with the given name already exists, or the write conflicted with another one running at the same time.',
    examples: {
      duplicateName: {
        summary: 'An example kind with this name already exists',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message: 'An example kind with this name already exists.',
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
  @ApiBody({ type: CreateExampleKindDTO })
  @ETagResponse()
  @UnwrapResult()
  public create(
    @Body() dto: CreateExampleKindDTO,
  ): ResultAsync<
    WithConcurrencyToken<ExampleKindDTO>,
    DuplicateExampleKindIdError | DuplicateExampleKindNameError
  > {
    return this.service.create(dto).map(({ value, token }) => ({ value: fromDomain(value), token }))
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', example: EXAMPLE_EXAMPLE_KIND_ID })
  @ApiOperation({
    operationId: 'example.kind.update',
    summary: 'Update an existing example kind.',
    description: 'Update an existing example kind, if it exists, and return it.',
  })
  @ApiHeader({
    name: 'If-Match',
    description: 'The example kind’s current ETag.',
    required: true,
    example: EXAMPLE_ETAG,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The operation completed successfully.',
    type: ExampleKindDTO,
    headers: {
      ETag: {
        description: 'The example kind’s current ETag.',
        schema: { type: 'string' },
        example: EXAMPLE_ETAG,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The example kind with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'An example kind with the given name already exists, or the write conflicted with another one running at the same time.',
    examples: {
      duplicateName: {
        summary: 'An example kind with this name already exists',
        value: {
          statusCode: HttpStatus.CONFLICT,
          message: 'An example kind with this name already exists.',
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
    description: 'The If-Match header does not match the example kind’s current ETag.',
  })
  @ApiResponse({
    status: HttpStatus.PRECONDITION_REQUIRED,
    description: 'The If-Match header is missing.',
  })
  @ApiBody({ type: UpdateExampleKindDTO })
  @ETagResponse()
  @UnwrapResult()
  public update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: ExampleKindID,
    @Body() dto: UpdateExampleKindDTO,
    @IfMatchHeader() expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<ExampleKindDTO>,
    ExampleKindNotFoundError | DuplicateExampleKindNameError | ExampleKindConcurrencyError
  > {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    return this.service
      .update(dto, expectedToken)
      .map(({ value, token }) => ({ value: fromDomain(value), token }))
  }
}
