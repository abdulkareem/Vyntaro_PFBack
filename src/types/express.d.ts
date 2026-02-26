import 'express'

declare global {
  namespace Express {
    interface Request {
      authUserId?: string
      authPinSet?: boolean
      authRole?: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
    }
  }
}

export {}
