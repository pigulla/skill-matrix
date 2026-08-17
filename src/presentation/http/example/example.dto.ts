import { createZodDto } from 'nestjs-zod'

import { Example, exampleSchema } from '#/domain/example/example.js'

const createExampleDTOSchema = exampleSchema
  .pick({ name: true, exampleKindId: true, url: true })
  .strict()
  .brand('create-example-dto')

const updateExampleDTOSchema = exampleSchema
  .pick({ id: true, name: true, exampleKindId: true, url: true })
  .strict()
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
