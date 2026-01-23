# Tenex

AI-powered recruiting pipeline for finding high-velocity engineers who thrive on uncapped performance-based pay.

## Setup

1. Install [Claude Code](https://claude.ai/download)
2. Install dependencies and start the dashboard:

```bash
cd dashboard
npm install
npm run dev
```

3. Open http://localhost:5173

## Skills

Three Claude Code skills power the pipeline:

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `prospect-researcher` | "find prospects", "start hunting" | Discover candidates from GitHub, Twitter, HN, ProductHunt |
| `prospect-enricher` | "enrich this person", "find contact info" | Research contact details and outreach context |
| `prospect-outreach` | "draft outreach", "check status" | Generate personalized messages |

## Pipeline

```
Discovery → Enrichment → Outreach → Tracking
```

The dashboard shows prospects at each stage with bulk actions for enrichment and drafting.

## Database

Check status anytime:

```bash
sqlite3 -header -column prospects.db \
  "SELECT 'Prospects:', COUNT(*) FROM prospects UNION ALL \
   SELECT 'Rejected:', COUNT(*) FROM rejected UNION ALL \
   SELECT 'Sources:', COUNT(*) FROM sources_checked"
```
