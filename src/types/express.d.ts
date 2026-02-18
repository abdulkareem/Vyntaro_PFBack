import 'express'

declare global {
  namespace Express {
    interface Request {
      authUserId?: string
    }
  }
}

export {}
