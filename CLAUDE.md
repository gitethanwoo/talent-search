# Tenex - Prospect Researcher

Finding high-velocity AI engineers who'd thrive on uncapped performance-based pay.

## Quick check

```bash
sqlite3 -header -column prospects.db "SELECT 'Prospects:', COUNT(*) FROM prospects UNION ALL SELECT 'Rejected:', COUNT(*) FROM rejected UNION ALL SELECT 'Sources:', COUNT(*) FROM sources_checked"
```

## View dashboard

```bash
cd dashboard && npm run dev
```

React dashboard at http://localhost:5173. Data loads live from SQLite.

## Visual verification

**USE AGENT-BROWSER TO CHECK YOUR WORK.** After any UI change:
```bash
agent-browser open http://localhost:5173
agent-browser screenshot /tmp/check.png
agent-browser close
```
Then read the screenshot to verify it looks correct. This catches bugs that builds miss.

## Skills

- `prospect-researcher` - find new prospects from GitHub, Twitter, HN, etc.
- `prospect-enricher` - deep research on a prospect (contact info, signals, outreach context)
- `prospect-outreach` - generate personalized messages, track the funnel

Trigger phrases: "find prospects", "start hunting", "enrich this person", "draft outreach", "check who we have"
