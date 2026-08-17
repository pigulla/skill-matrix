import { queryFiles } from '../../query-files.js'

export const QUERY = queryFiles(import.meta.dirname, [
  'delete',
  'get-all',
  'get',
  'insert',
  'update',
])
