import { ExampleKind } from '#/domain/example/kind/example-kind.js'
import { asExampleKindID } from '#/domain/example/kind/example-kind-id.js'

import { UNKNOWN_EXAMPLE_KIND_ID } from '../util/entity-ids.js'

export type ExampleKindProperties = {
  id: string
  name: string
}

export class ExampleKindBuilder {
  private properties: ExampleKindProperties = {
    id: UNKNOWN_EXAMPLE_KIND_ID,
    name: 'technology',
  }

  public withId(id: string): this {
    this.properties.id = id
    return this
  }

  public withName(name: string): this {
    this.properties.name = name
    return this
  }

  public with(properties: Partial<ExampleKindProperties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create<Full extends boolean = false>(
    ...args: Full extends true
      ? [properties: ExampleKindProperties]
      : [properties?: Partial<ExampleKindProperties>]
  ): ExampleKind {
    return new ExampleKindBuilder().with(args[0] ?? {}).build()
  }

  public static from(exampleKind: ExampleKind): ExampleKindBuilder {
    return new ExampleKindBuilder().with({
      id: exampleKind.id,
      name: exampleKind.name,
    })
  }

  public build(): ExampleKind {
    return new ExampleKind({
      id: asExampleKindID(this.properties.id),
      name: this.properties.name,
    })
  }
}
