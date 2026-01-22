export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result'
  tool?: string
  content: string
}

export interface AgentTask {
  id: string
  action: string
  target: string
  status: 'running' | 'done' | 'error'
  startedAt: string
  completedAt?: string
  error?: string
  lastOutput?: string
  fullOutput?: string
  events?: StreamEvent[]
}

export interface Stats {
  prospects: number
  high_signal: number
  ships_fast: number
  ai_native: number
  sources: number
  rejected: number
}

export interface Prospect {
  id: number
  github_username: string
  name: string | null
  email: string | null
  twitter: string | null
  location: string | null
  company: string | null
  signal: string
  ships_fast: number
  ai_native: number
  source: string | null
  outreach_status: string | null
  notes: string | null
  bio: string | null
  comp_fit: string | null
  outreach_context: string | null
  fit: string | null
  enriched_at: string | null
}

export interface Draft {
  id: number
  github_username: string
  name: string | null
  email: string | null
  twitter: string | null
  subject: string
  body: string
  channel: string
  status: string
  created_at: string
}

export interface Source {
  source_type: string
  source_name: string
  checked_at: string
}

export interface Data {
  stats: Stats
  prospects: Prospect[]
  drafts: Draft[]
  sources: Source[]
}

export type OutreachFilter = 'all' | 'not_contacted' | 'in_progress' | 'replied' | 'interested' | 'closed'

export const outreachFilterLabels: Record<OutreachFilter, string> = {
  all: 'All',
  not_contacted: 'Not Contacted',
  in_progress: 'In Progress',
  replied: 'Replied',
  interested: 'Interested',
  closed: 'Closed'
}

export function isContactable(p: Prospect): boolean {
  return !!(p.email || p.twitter)
}
