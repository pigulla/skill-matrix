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

import { IExampleService } from '#/application/example/example.service.interface.js'
import type { ExampleID } from '#/domain/example/example-id.js'

import {
  CreateExampleDTO,
  ExampleDTO,
  fromDomain,
  toDomain,
  UpdateExampleDTO,
} from './example.dto.js'

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
  public async getAll(): Promise<ExampleDTO[]> {
    const examples = await this.service.getAll()

    return examples.map(example => fromDomain(example))
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
  public async getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: ExampleID,
  ): Promise<ExampleDTO> {
    return fromDomain(await this.service.get(id))
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
  public async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: ExampleID,
  ): Promise<void> {
    await this.service.delete(id)
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
  public async create(@Body() dto: CreateExampleDTO): Promise<ExampleDTO> {
    const result = await this.service.create(dto)

    return fromDomain(result)
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
  public async update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: ExampleID,
    @Body() dto: UpdateExampleDTO,
  ): Promise<ExampleDTO> {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    const result = await this.service.update(toDomain(dto))

    return fromDomain(result)
  }
}
