---
name: prospect-researcher
description: Find and qualify AI engineer prospects for recruiting. Use when asked to find candidates, research developers, manage prospect pipeline, check sources, or kick off research agents. Triggers on requests like "find prospects", "research AI engineers", "check who we have", "add a source", "start hunting".
---

# Prospect Researcher

Find high-velocity AI engineers who'd thrive on uncapped performance-based pay.

## Ideal Prospect Profile

**We want people who:**
- Ship fast (weekend projects, rapid iteration, "built this in 2 days")
- Are AI-native (use Claude, Cursor, Copilot daily)
- Have proof of shipping (not just contributions - actual products)
- Would love uncapped comp (freelancers, frustrated employees, ambitious builders)

**Reject:**
- Big tech (Anthropic, Vercel, OpenAI, Google, Microsoft, LangChain)
- Funded startup founders (won't leave)
- Students, bots, empty profiles

## Database: prospects.db

```sql
prospects (
  github_username, name, email, twitter, location, company, bio, blog, followers,
  signal,      -- high/medium/low
  ships_fast,  -- 1 if evidence of rapid building
  ai_native,   -- 1 if uses Claude/Cursor/etc
  portfolio,   -- links to shipped things
  comp_fit,    -- why uncapped pay appeals (freelancer? frustrated?)
  source, notes
)
rejected (github_username, reason)
sources_checked (source_type, source_name, checked_at)
```

## Quick Commands

```bash
# Stats
sqlite3 -header -column prospects.db "SELECT 'Prospects:', COUNT(*) FROM prospects UNION ALL SELECT 'Rejected:', COUNT(*) FROM rejected UNION ALL SELECT 'Sources:', COUNT(*) FROM sources_checked"

# Best prospects (high signal + ships fast)
sqlite3 -header -column prospects.db "SELECT github_username, name, email, signal, ships_fast, ai_native FROM prospects WHERE signal='high' OR ships_fast=1 ORDER BY ships_fast DESC, signal"

# Sources checked
sqlite3 -header -column prospects.db "SELECT source_type, source_name FROM sources_checked ORDER BY checked_at DESC LIMIT 20"

# Stale sources (ready to re-check)
sqlite3 -header -column prospects.db "
SELECT source_type, source_name, checked_at,
  CASE source_type
    WHEN 'twitter_search' THEN '1 day'
    WHEN 'hn_search' THEN '7 days'
    WHEN 'producthunt' THEN '7 days'
    WHEN 'github_repo' THEN '30 days'
    ELSE '30 days'
  END as refresh_interval
FROM sources_checked
WHERE (source_type='twitter_search' AND checked_at < datetime('now', '-1 day'))
   OR (source_type='hn_search' AND checked_at < datetime('now', '-7 days'))
   OR (source_type='producthunt' AND checked_at < datetime('now', '-7 days'))
   OR (source_type='github_repo' AND checked_at < datetime('now', '-30 days'))
ORDER BY checked_at"
```

## Source Refresh Intervals

| Source | Turnover | Re-check |
|--------|----------|----------|
| twitter_search | High | Daily |
| hn_search | Medium | Weekly |
| producthunt | Medium | Weekly |
| github_repo | Low | Monthly |
| awesome_list | Very low | Monthly |

---

## Source Playbooks

### GitHub Repos
**Requires:** `gh` CLI with GH_TOKEN

**Find repos:**
```bash
gh search repos "AI agent" --sort=stars --limit=20 --json fullName,stargazersCount
gh search repos "MCP server" --sort=stars --limit=15 --json fullName,stargazersCount
```

**Mine contributors:**
```bash
gh api repos/{owner}/{repo}/contributors --jq '.[].login' | head -20
gh api users/{username} --jq '{login, name, company, location, bio, email, twitter_username, blog, followers}'
```

**Log source:** `sqlite3 prospects.db "INSERT OR IGNORE INTO sources_checked (source_type, source_name) VALUES ('github_repo', '{owner}/{repo}')"`

---

### Twitter/Nitter (HIGH SIGNAL)
**Requires:** `agent-browser` skill for reliable scraping

**Why high signal:** People tweet about what they're building. "Built this in a weekend with Claude" = exactly who we want.

**Searches to run:**
- `"built with claude"` - AI-native builders
- `"vibe coding"` - Using AI to ship fast
- `"shipped in a weekend"` - Speed demons
- `"cursor ai"` - Tool users
- `"claude code"` - Our people

**Process:**
1. Use `agent-browser` to navigate to nitter search: `https://nitter.poast.org/search?f=tweets&q={query}`
   - Fallbacks: nitter.privacydev.net, nitter.net
2. Screenshot and extract usernames from results
3. For each interesting poster:
   - Check their bio for GitHub link
   - Cross-reference: `gh api users/{username}`
   - If no GitHub, still add with twitter handle as identifier
4. Look for signals: shipped products, AI tool usage, speed brags

**Log source:** `sqlite3 prospects.db "INSERT OR IGNORE INTO sources_checked (source_type, source_name) VALUES ('twitter_search', '{query}')"`

---

### Hacker News
**Requires:** None (public API)

**Searches:**
```
https://hn.algolia.com/api/v1/search?query=show+hn+ai+agent&tags=story
https://hn.algolia.com/api/v1/search?query=built+with+claude&tags=comment
https://hn.algolia.com/api/v1/search?query=vibe+coding&tags=story
```

**Process:**
1. WebFetch the Algolia API
2. Extract authors from stories/comments
3. HN username often matches GitHub - try `gh api users/{hn_username}`
4. Check their HN profile for links: `https://news.ycombinator.com/user?id={username}`

**High signal:** Show HN posts = they shipped something. Comments on AI threads = they're in the space.

**Log source:** `sqlite3 prospects.db "INSERT OR IGNORE INTO sources_checked (source_type, source_name) VALUES ('hn_search', '{query}')"`

---

### ProductHunt
**Requires:** `agent-browser` skill

**Process:**
1. Navigate to ProductHunt AI category or search "AI agent", "coding assistant"
2. Find makers of AI products (not just voters)
3. Makers have shipped - that's proof of execution
4. Cross-reference GitHub from their profiles

**Log source:** `sqlite3 prospects.db "INSERT OR IGNORE INTO sources_checked (source_type, source_name) VALUES ('producthunt', '{search}')"`

---

## Qualifying & Adding Prospects

**Check if exists:**
```bash
sqlite3 prospects.db "SELECT 1 FROM prospects WHERE github_username='{user}' UNION SELECT 1 FROM rejected WHERE github_username='{user}'"
```

**Add prospect:**
```bash
sqlite3 prospects.db "INSERT INTO prospects (github_username, name, email, twitter, location, company, followers, signal, ships_fast, ai_native, portfolio, comp_fit, source, notes) VALUES ('{user}', '{name}', '{email}', '{twitter}', '{location}', '{company}', {followers}, '{signal}', {ships_fast}, {ai_native}, '{portfolio}', '{comp_fit}', '{source}', '{notes}')"
```

**Reject:**
```bash
sqlite3 prospects.db "INSERT INTO rejected (github_username, reason) VALUES ('{user}', '{reason}')"
```

---

## Dispatching Research Agents

Spawn parallel Task agents for independent sources:

```
Task (GitHub): "Mine contributors from {repo}. Check profiles, qualify per criteria in skill. Add to prospects.db or reject. Log source when done."

Task (Twitter): "Use agent-browser to search nitter for '{query}'. Find people tweeting about building with AI. Extract usernames, cross-ref GitHub, add promising ones. Log source."

Task (HN): "WebFetch HN Algolia for '{query}'. Find Show HN authors and active commenters. Cross-ref GitHub, qualify, add to DB. Log source."
```

Each agent must:
1. Check if source already processed in sources_checked
2. Extract usernames/profiles
3. For each: check if exists → qualify → add or reject
4. Log source as checked when done
