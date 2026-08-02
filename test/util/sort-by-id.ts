export function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id.localeCompare(b.id)
}
