import z from 'zod'

// Postgres's native uuid type accepts either case but always returns lowercase, and HTTP clients
// may send either case too. Normalize to lowercase here so every consumer of a branded ID always
// sees the canonical form, rather than rejecting non-lowercase input outright.
export const idSchema = z.uuidv4().transform(id => id.toLowerCase())
