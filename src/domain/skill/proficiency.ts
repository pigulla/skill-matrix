import z from 'zod'

export const proficiencySchema = z.number().int().min(0).max(4).brand<'proficiency'>().meta({
  description: 'The required proficiency level for a skill (0–4).',
  example: 3,
})

export type Proficiency = z.infer<typeof proficiencySchema>

export function asProficiency(value: number): Proficiency {
  return proficiencySchema.parse(value)
}
