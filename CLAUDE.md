# TeneX - Prospect Researcher

Finding high-velocity AI engineers who'd thrive on uncapped performance-based pay.

## Quick check

```bash
sqlite3 -header -column prospects.db "SELECT 'Prospects:', COUNT(*) FROM prospects UNION ALL SELECT 'Rejected:', COUNT(*) FROM rejected UNION ALL SELECT 'Sources:', COUNT(*) FROM sources_checked"
```

## View dashboard

```bash
python3 view.py
```

Opens a Tailwind-styled dashboard in the browser with stats, outreach pipeline, and all prospects.

## Skills

- `prospect-researcher` - find new prospects from GitHub, Twitter, HN, etc.
- `prospect-enricher` - deep research on a prospect (contact info, signals, outreach context)
- `prospect-outreach` - generate personalized messages, track the funnel

Trigger phrases: "find prospects", "start hunting", "enrich this person", "draft outreach", "check who we have"
