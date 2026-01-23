# Tenex

AI-powered recruiting pipeline for finding high-velocity engineers who thrive on uncapped performance-based pay.

## Quick Start

```bash
# Check database status
sqlite3 -header -column prospects.db \
  "SELECT 'Prospects:', COUNT(*) FROM prospects UNION ALL \
   SELECT 'Rejected:', COUNT(*) FROM rejected UNION ALL \
   SELECT 'Sources:', COUNT(*) FROM sources_checked"

# Start the dashboard
cd dashboard && npm run dev
```

Open http://localhost:5173

## What It Does

Tenex automates the recruiting pipeline:

```
Discovery → Enrichment → Outreach → Tracking
```

1. **Discovery** - Mine GitHub, Twitter, HN, ProductHunt for prospects matching target criteria
2. **Enrichment** - Deep research to find contact info, verify signals, gather outreach context
3. **Outreach** - Generate personalized emails using prospect-specific hooks
4. **Tracking** - Monitor replies, follow-ups, and conversion through the funnel

## Skills

Three Claude Code skills power the pipeline:

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `prospect-researcher` | "find prospects", "start hunting" | Discover candidates from various sources |
| `prospect-enricher` | "enrich this person", "find contact info" | Research contact details and context |
| `prospect-outreach` | "draft outreach", "check status" | Generate personalized messages |

## Dashboard Features

**Prospects Tab**
- Pipeline view: Needs Enrichment → Needs Draft → Ready to Send → Contacted
- Bulk selection for batch operations
- Real-time task progress indicators

**Drafts Tab**
- Card-based message preview
- Edit subject/body inline
- Approve or delete drafts

**Sources Tab**
- Track which sources have been mined
- Trigger new research runs

**Chat Panel**
- Embedded Claude with full agent capabilities
- Ask questions, run research, manage pipeline

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Backend**: Node.js server embedded in Vite config
- **Database**: SQLite (better-sqlite3)
- **AI**: Claude CLI for research, enrichment, and messaging
- **Real-time**: Server-Sent Events for live updates

## Database Schema

```sql
prospects (
  github_username, name, email, twitter, linkedin_url,
  signal, ships_fast, ai_native, portfolio, comp_fit,
  enriched_at, outreach_status, outreach_context
)

outreach_messages (
  prospect_id, channel, subject, body, status, sent_at
)

sources_checked (source_type, source_name, checked_at)
rejected (github_username, reason, rejected_at)
```

## Useful Queries

```bash
# High-signal prospects
sqlite3 -header -column prospects.db \
  "SELECT github_username, name, signal FROM prospects WHERE signal='high'"

# Pipeline summary
sqlite3 -header -column prospects.db \
  "SELECT outreach_status, COUNT(*) FROM prospects GROUP BY outreach_status"

# Prospects needing enrichment
sqlite3 -header -column prospects.db \
  "SELECT github_username, name FROM prospects WHERE enriched_at IS NULL"
```

## Development

```bash
cd dashboard
npm install
npm run dev        # Start dev server with API
npm run build      # Production build
npm run lint       # ESLint check
```

Requires:
- Node.js 18+
- Claude CLI installed and authenticated
- `GH_TOKEN` environment variable for GitHub API

## Architecture

```
/dashboard
  /src
    /components
      /Prospects      # List + detail views
      /Drafts         # Message management
      /ChatPanel      # Embedded Claude
      /TaskPanel      # Real-time task viewer
    App.tsx           # Main dashboard
    types/index.ts    # TypeScript interfaces
  vite.config.ts      # Server + API endpoints

/prospect-researcher  # Discovery skill
/prospect-enricher    # Research skill
/prospect-outreach    # Messaging skill

prospects.db          # SQLite database
```

## License

Private.
