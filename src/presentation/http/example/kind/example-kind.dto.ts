import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { ExampleKind, exampleKindSchema } from '#/domain/example/kind/example-kind.js'

const updateExampleKindDTOSchema = z.strictObject(exampleKindSchema.shape).brand('update-kind-dto')

const createExampleKindDTOSchema = updateExampleKindDTOSchema
  .omit({ id: true })
  .brand('create-kind-dto')

const exampleKindDTOSchema = updateExampleKindDTOSchema.brand('kind-dto')

export class CreateExampleKindDTO extends createZodDto(createExampleKindDTOSchema) {}

export class UpdateExampleKindDTO extends createZodDto(updateExampleKindDTOSchema) {}

export class ExampleKindDTO extends createZodDto(exampleKindDTOSchema) {}

export function fromDomain(exampleKind: ExampleKind): ExampleKindDTO {
  return exampleKindDTOSchema.parse({
    id: exampleKind.id,
    name: exampleKind.name,
  })
}
