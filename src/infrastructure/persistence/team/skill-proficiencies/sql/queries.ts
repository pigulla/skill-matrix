import { queryFiles } from '../../../query-files.js'

export const QUERY = queryFiles(import.meta.dirname, ['delete', 'get', 'insert', 'update'])
