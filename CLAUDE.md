# TeneX - Prospect Researcher

Finding high-velocity AI engineers who'd thrive on uncapped performance-based pay.

## Quick check

```bash
sqlite3 -header -column prospects.db "SELECT 'Prospects:', COUNT(*) FROM prospects UNION ALL SELECT 'Rejected:', COUNT(*) FROM rejected UNION ALL SELECT 'Sources:', COUNT(*) FROM sources_checked"
```

## Workflow

Use the `prospect-researcher` skill for hunting, qualifying, and managing sources.

Trigger phrases: "find prospects", "start hunting", "check who we have", "research AI engineers"
