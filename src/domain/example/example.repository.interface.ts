import type { Example } from './example.js'
import type { ExampleID } from './example-id.js'

export abstract class IExampleRepository {
  public abstract delete(id: ExampleID): Promise<void>

  public abstract getAll(): Promise<Example[]>

  public abstract get(id: ExampleID): Promise<Example>

  public abstract getMany(ids: ReadonlySet<ExampleID>): Promise<Example[]>

  public abstract create(example: Example): Promise<Example>

  public abstract update(example: Example): Promise<Example>
}
