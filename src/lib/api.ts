import type {
  ApiErrorBody,
  Bookmark,
  BookmarkPatch,
  DocumentList,
  DocumentProgress,
  Highlight,
  HighlightPatch,
  MoveDocument,
  MoveDocumentResult,
  NewBookmark,
  NewHighlight,
  Settings,
  StudyState,
} from '../../shared/types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function errorMessage(response: Response, method: string, url: string): Promise<string> {
  const text = await response.text()
  try {
    return (JSON.parse(text) as ApiErrorBody).error
  } catch {
    return `${method} ${url} が失敗しました（${response.status}）: ${text.slice(0, 200)}`
  }
}

async function request<T>(method: string, url: string, body?: unknown, keepalive = false): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
  })
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response, method, url))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function vaultUrl(path: string): string {
  return `/vault/${path.split('/').map(encodeURIComponent).join('/')}`
}

export const api = {
  documents: () => request<DocumentList>('GET', '/api/documents'),
  state: () => request<StudyState>('GET', '/api/state'),
  saveProgress: (entry: DocumentProgress, keepalive: boolean) =>
    request<DocumentProgress>('PUT', '/api/progress', entry, keepalive),
  settings: () => request<Settings>('GET', '/api/settings'),
  saveSettings: (settings: Settings) => request<Settings>('PUT', '/api/settings', settings),

  addBookmark: (input: NewBookmark) => request<Bookmark>('POST', '/api/bookmarks', input),
  updateBookmark: (id: string, patch: BookmarkPatch) =>
    request<Bookmark>('PATCH', `/api/bookmarks/${encodeURIComponent(id)}`, patch),
  deleteBookmark: (id: string) => request<void>('DELETE', `/api/bookmarks/${encodeURIComponent(id)}`),

  addHighlight: (input: NewHighlight) => request<Highlight>('POST', '/api/highlights', input),
  updateHighlight: (id: string, patch: HighlightPatch) =>
    request<Highlight>('PATCH', `/api/highlights/${encodeURIComponent(id)}`, patch),
  deleteHighlight: (id: string) => request<void>('DELETE', `/api/highlights/${encodeURIComponent(id)}`),

  moveDocument: (input: MoveDocument) => request<MoveDocumentResult>('POST', '/api/documents/move', input),

  async documentHtml(path: string): Promise<string> {
    const url = vaultUrl(path)
    const response = await fetch(url)
    if (!response.ok) throw new ApiError(response.status, await errorMessage(response, 'GET', url))
    return response.text()
  },
}
