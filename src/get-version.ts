/* v8 ignore file -- @preserve */

import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const versionFilePath = fileURLToPath(new URL('./version.json', import.meta.url))

export async function getVersion(): Promise<string> {
  try {
    await access(versionFilePath)
  } catch {
    return 'DEV'
  }

  const data = await import('#/version.json', { with: { type: 'json' } })
  return data.default.version
}
