import type { Example } from '#/domain/example/example.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import type { ExampleKind } from '#/domain/example-kind/example-kind.js'

export abstract class IExampleService {
  public abstract create(data: {
    name: string
    kind: ExampleKind
    url: string | null
  }): Promise<Example>
  public abstract delete(id: ExampleID): Promise<void>
  public abstract get(id: ExampleID): Promise<Example>
  public abstract getAll(): Promise<Example[]>
  public abstract update(example: Example): Promise<Example>
}
