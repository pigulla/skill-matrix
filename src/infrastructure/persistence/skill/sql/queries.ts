import { queryFiles } from '../../query-files.js'

export const QUERY = queryFiles(import.meta.dirname, [
  'associate-example-with-skill',
  'delete',
  'get',
  'get-all',
  'insert',
  'unassociate-all-examples-from-skill',
  'update',
])
