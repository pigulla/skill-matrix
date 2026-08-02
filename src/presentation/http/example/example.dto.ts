import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { Example, exampleSchema } from '#/domain/example/example.js'
import { exampleIdSchema } from '#/domain/example/example-id.js'

const createExampleDTOSchema = z
  .strictObject(exampleSchema.pick({ name: true, kind: true, url: true }).shape)
  .brand<'create-example-dto'>('create-example-dto')

const updateExampleDTOSchema = createExampleDTOSchema
  .extend({
    id: exampleIdSchema,
  })
  .brand<'update-example-dto'>('update-example-dto')

export const exampleDTOSchema = updateExampleDTOSchema.brand<'example-dto'>('example-dto')

export class CreateExampleDTO extends createZodDto(createExampleDTOSchema) {}

export class UpdateExampleDTO extends createZodDto(updateExampleDTOSchema) {}

export class ExampleDTO extends createZodDto(exampleDTOSchema) {}

export function fromDomain(example: Example): ExampleDTO {
  return exampleDTOSchema.parse({
    id: example.id,
    name: example.name,
    kind: example.kind,
    url: example.url,
  })
}

export function toDomain(example: ExampleDTO | UpdateExampleDTO): Example {
  return new Example(example)
}
