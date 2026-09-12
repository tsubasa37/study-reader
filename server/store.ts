import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { z } from 'zod'
import { hasErrorCode } from './errors'

export type StoreChange<T, R> = (current: T) => { next: T; result: R }

export class JsonStore<T> {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly file: string,
    private readonly schema: z.ZodType<T>,
    private readonly initial: () => T,
  ) {}

  async read(): Promise<T> {
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) return this.initial()
      throw error
    }
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (error) {
      throw new Error(`${this.file} を JSON として読めません（${(error as Error).message}）。中身を直すか、別名に移してから開き直してください`)
    }
    const parsed = this.schema.safeParse(data)
    if (!parsed.success) {
      throw new Error(`${this.file} の中身が想定と違います: ${parsed.error.message}`)
    }
    return parsed.data
  }

  update<R>(change: StoreChange<T, R>): Promise<R> {
    const run = this.queue.then(async () => {
      const { next, result } = change(await this.read())
      await this.write(next)
      return result
    })
    // 失敗は呼び出し側へ返し、後に並んだ書き込みは止めない
    this.queue = run.catch(() => undefined)
    return run
  }

  private async write(data: T): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    await rename(temporary, this.file)
  }
}
