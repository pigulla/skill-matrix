import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'

import { toConcurrencyToken } from './concurrency-token.codec.js'

describe('toConcurrencyToken', () => {
  it('should return a 32-character lowercase hex string', () => {
    const token = toConcurrencyToken(dayjs(0))

    expect(token).toMatch(/^[0-9a-f]{32}$/)
  })

  it('should return the md5 hash of the epoch-millisecond value as a decimal string', () => {
    expect(toConcurrencyToken(dayjs(0))).toBe('cfcd208495d565ef66e7dff9f98764da')
    expect(toConcurrencyToken(dayjs(1))).toBe('c4ca4238a0b923820dcc509a6f75849b')
  })

  it('should return the same token for the same timestamp', () => {
    const timestamp = dayjs('2026-01-01T00:00:00.000Z')

    expect(toConcurrencyToken(timestamp)).toBe(toConcurrencyToken(timestamp))
  })

  it('should return different tokens for different timestamps', () => {
    const a = toConcurrencyToken(dayjs('2026-01-01T00:00:00.000Z'))
    const b = toConcurrencyToken(dayjs('2026-01-01T00:00:00.001Z'))

    expect(a).not.toBe(b)
  })
})
