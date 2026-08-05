import { Example } from '#/domain/example/example.js'
import { asExampleID } from '#/domain/example/example-id.js'
import { asExampleKind } from '#/domain/example-kind/example-kind.js'

import { UNKNOWN_EXAMPLE_ID } from '../util/entity-ids.js'

export type ExampleProperties = {
  id: string
  name: string
  kind: string
  url: string | null
}

export class ExampleBuilder {
  private properties: ExampleProperties = {
    id: UNKNOWN_EXAMPLE_ID,
    name: 'TypeScript',
    kind: 'technology',
    url: null,
  }

  public withId(id: string): this {
    this.properties.id = id
    return this
  }

  public withName(name: string): this {
    this.properties.name = name
    return this
  }

  public withKind(kind: string): this {
    this.properties.kind = kind
    return this
  }

  public withUrl(url: string | null): this {
    this.properties.url = url
    return this
  }

  public with(properties: Partial<ExampleProperties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create<Full extends boolean = false>(
    ...args: Full extends true
      ? [properties: ExampleProperties]
      : [properties?: Partial<ExampleProperties>]
  ): Example {
    return new ExampleBuilder().with(args[0] ?? {}).build()
  }

  public static from(example: Example): ExampleBuilder {
    return new ExampleBuilder().with({
      id: example.id,
      name: example.name,
      kind: example.kind,
      url: example.url,
    })
  }

  public build(): Example {
    return new Example({
      id: asExampleID(this.properties.id),
      name: this.properties.name,
      kind: asExampleKind(this.properties.kind),
      url: this.properties.url,
    })
  }
}
