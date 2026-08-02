import type { ExampleKind } from '#/domain/example-kind/example-kind.js'

export abstract class IExampleKindService {
  public abstract create(kind: ExampleKind): Promise<ExampleKind>
  public abstract delete(kind: ExampleKind): Promise<void>
  public abstract get(kind: ExampleKind): Promise<ExampleKind>
  public abstract getAll(): Promise<ExampleKind[]>
}
