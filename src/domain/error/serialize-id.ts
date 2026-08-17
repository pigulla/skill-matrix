export type Identifier = string | Readonly<Record<string, string>>

export function serializeId(id: Identifier): string {
  return `(${Object.entries(typeof id === 'string' ? { id } : id)
    .map(([k, v]) => `${k}=${v}`)
    .join(',')})`
}
