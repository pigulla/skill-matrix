import { createZodDto } from 'nestjs-zod'

import { ExampleKind, exampleKindSchema } from '#/domain/example/kind/example-kind.js'

const createExampleKindDTOSchema = exampleKindSchema
  .pick({ name: true })
  .strict()
  .brand('create-example-kind-dto')

const updateExampleKindDTOSchema = exampleKindSchema
  .pick({ id: true, name: true })
  .strict()
  .brand('update-example-kind-dto')

const exampleKindDTOSchema = updateExampleKindDTOSchema.brand('example-kind-dto')

export class CreateExampleKindDTO extends createZodDto(createExampleKindDTOSchema) {}

export class UpdateExampleKindDTO extends createZodDto(updateExampleKindDTOSchema) {}

export class ExampleKindDTO extends createZodDto(exampleKindDTOSchema) {}

export function fromDomain(exampleKind: ExampleKind): ExampleKindDTO {
  return exampleKindDTOSchema.parse({
    id: exampleKind.id,
    name: exampleKind.name,
  })
}
