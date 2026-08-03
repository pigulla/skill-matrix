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

import { IExampleService } from '#/application/example/example.service.interface.js'
import type { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import type { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import type { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import type { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import type { ExampleKindReferenceNotFoundError } from '#/domain/example-kind/error/example-kind-reference-not-found.error.js'
import { UnwrapResult } from '#/util/unwrap-result.decorator.js'

import { CreateExampleDTO, ExampleDTO, fromDomain, UpdateExampleDTO } from './example.dto.js'

@Controller('examples')
@ApiTags('Examples')
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description:
    'A query or route parameter, the payload or a header was malformed and did not pass validation.',
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
  @ApiOperation({ summary: 'Get all examples.', description: 'Get all examples.' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [ExampleDTO],
    description: 'The operation completed successfully.',
  })
  @UnwrapResult()
  public getAll(): ResultAsync<ExampleDTO[], never> {
    return this.service.getAll().map(examples => examples.map(example => fromDomain(example)))
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an example.',
    description: 'Get the example with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ExampleDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The example with the given id was not found.',
  })
  @UnwrapResult()
  public getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: ExampleID,
  ): ResultAsync<ExampleDTO, ExampleNotFoundError> {
    return this.service.get(id).map(fromDomain)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an example.',
    description: 'Delete the example with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
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
    description: 'The example is still referenced by a skill.',
  })
  @UnwrapResult()
  public delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: ExampleID,
  ): ResultAsync<void, ExampleNotFoundError | ExampleInUseError> {
    return this.service.delete(id)
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new example.',
    description: 'Create a new example and return it.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ExampleDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'An example with an identical name already exists.',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The referenced skill does not exist.',
  })
  @UnwrapResult()
  public create(
    @Body() dto: CreateExampleDTO,
  ): ResultAsync<
    ExampleDTO,
    DuplicateExampleIdError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  > {
    return this.service.create(dto).map(fromDomain)
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({
    summary: 'Update an existing example.',
    description: 'Update an existing example, if it exists, and return it.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ExampleDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The example with the given id was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'An example with an identical name already exists.',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The referenced skill does not exist.',
  })
  @UnwrapResult()
  public update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: ExampleID,
    @Body() dto: UpdateExampleDTO,
  ): ResultAsync<
    ExampleDTO,
    ExampleNotFoundError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  > {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    return this.service.update(dto).map(fromDomain)
  }
}
