import type { ExampleKind } from './example-kind.js'

export abstract class IExampleKindRepository {
  public abstract getAll(): Promise<ExampleKind[]>

  public abstract get(kind: ExampleKind): Promise<ExampleKind>

  public abstract create(kind: ExampleKind): Promise<ExampleKind>

  public abstract delete(kind: ExampleKind): Promise<void>
}
