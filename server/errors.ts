export class HttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 500,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
