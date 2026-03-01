import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.middleware.js'

export const ledgerRouter = Router()

ledgerRouter.use(requireAuth)

ledgerRouter.get('/categories', async (req, res) => {
  const userId = req.user?.id ?? req.authUserId
  if (!userId) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' })
  }

  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, kind: true },
    orderBy: { name: 'asc' }
  })

  return res.json({
    success: true,
    data: categories.map((category) => ({
      id: category.id,
      name: category.name,
      type: category.kind
    }))
  })
})
