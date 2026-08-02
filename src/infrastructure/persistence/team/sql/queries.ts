import { queryFiles } from '../../query-files.js'

export const QUERY = queryFiles(import.meta.dirname, [
  'delete',
  'delete-team-skill-proficiency',
  'get',
  'get-all',
  'get-team-skill-proficiencies',
  'insert',
  'insert-team-skill-proficiency',
  'update',
  'update-team-skill-proficiency',
])
