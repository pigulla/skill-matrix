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

import { ISkillService } from '#/application/skill/skill.service.interface.js'
import type { SkillID } from '#/domain/skill/skill-id.js'

import { CreateSkillDTO, fromDomain, SkillDTO, UpdateSkillDTO } from './skill.dto.js'

@Controller('skills')
@ApiTags('Skills')
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description:
    'A query or route parameter, the payload or a header was malformed and did not pass validation.',
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
  @ApiOperation({ summary: 'Get all skills.', description: 'Get all skills.' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [SkillDTO],
    description: 'The operation completed successfully.',
  })
  public async getAll(): Promise<SkillDTO[]> {
    const skills = await this.service.getAll()

    return skills.map(skill => fromDomain(skill))
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a skill.',
    description: 'Get the skill with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SkillDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The skill with the given id was not found.',
  })
  public async getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: SkillID,
  ): Promise<SkillDTO> {
    return fromDomain(await this.service.get(id))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a skill.',
    description: 'Delete the skill with the given id, if it exists.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The skill with the given id was not found.',
  })
  public async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: SkillID,
  ): Promise<void> {
    await this.service.delete(id)
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new skill.',
    description: 'Create a new skill and return it.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: SkillDTO,
    description: 'The operation completed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: `A uniqueness constraint on one of the skill's properties is being violated.`,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'A referenced example was not found.',
  })
  public async create(@Body() dto: CreateSkillDTO): Promise<SkillDTO> {
    const result = await this.service.create({
      name: dto.name,
      description: dto.description,
      exampleIds: new Set(dto.exampleIds),
    })

    return fromDomain(result)
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({
    summary: 'Update an existing skill.',
    description: 'Update an existing skill, if it exists, and return it.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SkillDTO,
    description: 'The operation completed successfully.',
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
  public async update(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: SkillID,
    @Body() dto: UpdateSkillDTO,
  ): Promise<SkillDTO> {
    if (id !== dto.id) {
      throw new BadRequestException('The id in the payload does not match the id in the route.')
    }

    const result = await this.service.update({
      id: dto.id,
      name: dto.name,
      description: dto.description,
      exampleIds: new Set(dto.exampleIds),
    })

    return fromDomain(result)
  }
}
