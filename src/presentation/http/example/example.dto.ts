import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { Example, exampleSchema } from '#/domain/example/example.js'
import { exampleIdSchema } from '#/domain/example/example-id.js'

const createExampleDTOSchema = z
  .strictObject(exampleSchema.pick({ name: true, exampleKindId: true, url: true }).shape)
  .brand('create-example-dto')

const updateExampleDTOSchema = createExampleDTOSchema
  .extend({
    id: exampleIdSchema,
  })
  .brand('update-example-dto')

const exampleDTOSchema = updateExampleDTOSchema.brand('example-dto')

export class CreateExampleDTO extends createZodDto(createExampleDTOSchema) {}

export class UpdateExampleDTO extends createZodDto(updateExampleDTOSchema) {}

export class ExampleDTO extends createZodDto(exampleDTOSchema) {}

export function fromDomain(example: Example): ExampleDTO {
  return exampleDTOSchema.parse({
    id: example.id,
    name: example.name,
    exampleKindId: example.exampleKindId,
    url: example.url,
  })
}
