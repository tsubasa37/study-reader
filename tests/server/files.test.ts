import { describe, expect, it } from 'vitest'
import { HttpError } from '../../server/errors'
import { contentTypeFor, decodePathname } from '../../server/files'

describe('decodePathname', () => {
  it('日本語のファイル名を元に戻す', () => {
    expect(decodePathname(`http://localhost/vault/${encodeURIComponent('教材.html')}`, '/vault/')).toBe('教材.html')
  })

  it('URL の書き方が壊れていれば断る', () => {
    expect(() => decodePathname('http://localhost/vault/%', '/vault/')).toThrow(HttpError)
  })
})

describe('contentTypeFor', () => {
  it.each([
    ['a.html', 'text/html; charset=utf-8'],
    ['a.pdf', 'application/pdf'],
    ['a.wasm', 'application/wasm'],
    ['a.PNG', 'image/png'],
    ['a.unknown', 'application/octet-stream'],
  ])('%s は %s', (file, expected) => {
    expect(contentTypeFor(file)).toBe(expected)
  })
})
