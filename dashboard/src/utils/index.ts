import type { Prospect } from '../types'

export function mailto(to: string, subject: string, body: string) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function isContactable(p: Prospect): boolean {
  return !!(p.email || p.twitter)
}
