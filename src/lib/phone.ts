import { z } from 'zod'

const phoneInputPattern = /^\+?[0-9\s()-]{7,20}$/

export const phoneSchema = z.string().regex(phoneInputPattern, 'Invalid phone number')

export function normalizePhone(phone: string): string {
  const compact = phone.trim().replace(/[\s()-]/g, '')
  return compact.startsWith('+') ? compact.slice(1) : compact
}
