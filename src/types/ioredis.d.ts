declare module 'ioredis' {
  export type RedisOptions = {
    lazyConnect?: boolean
    maxRetriesPerRequest?: number
    enableReadyCheck?: boolean
    connectTimeout?: number
    tls?: Record<string, unknown>
  }

  export class Redis {
    constructor(url: string, options?: RedisOptions)
    on(event: 'connect' | 'ready', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this
    set(key: string, value: string, mode: 'EX', seconds: number): Promise<'OK' | null>
    get(key: string): Promise<string | null>
    del(key: string): Promise<number>
  }
}
