import { queryFiles } from '../../query-files.js'

export const QUERY = queryFiles(import.meta.dirname, [
  'associate-example-with-skill',
  'delete-skill',
  'delete-skill-examples',
  'get-all-skills',
  'get-skill',
  'insert-skill',
  'update-skill',
])
