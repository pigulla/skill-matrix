import { queryFiles } from '../../query-files.js'

export const QUERY = queryFiles(import.meta.dirname, [
  'assign-team',
  'delete',
  'get',
  'get-all',
  'insert',
  'update',
])
