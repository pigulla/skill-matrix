export function by<T extends string, S extends Record<T, string>>(
  property: T,
): (a: S, b: S) => number {
  return (a, b) => a[property].localeCompare(b[property])
}

export const byId = by('id')
