import { Example } from '#/domain/example/example.js'
import { asExampleID } from '#/domain/example/example-id.js'
import { asExampleKindID } from '#/domain/example/kind/example-kind-id.js'

import { UNKNOWN_EXAMPLE_ID, UNKNOWN_EXAMPLE_KIND_ID } from '../util/entity-ids.js'

type Properties = {
  id: string
  name: string
  exampleKindId: string
  url: string | null
}

export class ExampleBuilder {
  private properties: Properties = {
    id: UNKNOWN_EXAMPLE_ID,
    name: 'TypeScript',
    exampleKindId: UNKNOWN_EXAMPLE_KIND_ID,
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

  public withExampleKindId(exampleKindId: string): this {
    this.properties.exampleKindId = exampleKindId
    return this
  }

  public withUrl(url: string | null): this {
    this.properties.url = url
    return this
  }

  public with(properties: Partial<Properties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create<Full extends boolean = false>(
    ...args: Full extends true ? [properties: Properties] : [properties?: Partial<Properties>]
  ): Example {
    return new ExampleBuilder().with(args[0] ?? {}).build()
  }

  public static from(example: Example): ExampleBuilder {
    return new ExampleBuilder().with({
      id: example.id,
      name: example.name,
      exampleKindId: example.exampleKindId,
      url: example.url,
    })
  }

  public build(): Example {
    return new Example({
      id: asExampleID(this.properties.id),
      name: this.properties.name,
      exampleKindId: asExampleKindID(this.properties.exampleKindId),
      url: this.properties.url,
    })
  }
}
