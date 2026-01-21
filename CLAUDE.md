# TeneX - AI Talent Sourcing

Find engineering candidates who contribute to AI/agent projects.

## "Find more prospects" means:

1. **Check these GitHub repos for contributors:**
   ```
   gh api repos/vercel-labs/agent-browser/contributors
   gh api repos/anthropics/claude-code/contributors
   gh api repos/vercel/ai/contributors
   gh api repos/plandex-ai/plandex/contributors
   gh api repos/openai/openai-agents-python/contributors
   ```

2. **Check HN for AI agent discussions:**
   ```
   https://hn.algolia.com/api/v1/search?query=claude%20code&tags=story
   https://hn.algolia.com/api/v1/search?query=AI%20coding%20agent&tags=story
   ```

3. **Check Twitter via Nitter (no auth required):**
   ```
   https://nitter.poast.org/search?f=tweets&q=claude+code
   https://nitter.poast.org/search?f=tweets&q=AI+coding+agent
   https://nitter.poast.org/search?f=tweets&q=plandex
   https://nitter.poast.org/search?f=tweets&q=vercel+ai+sdk
   ```
   Fallback instances if poast is down:
   - nitter.privacydev.net
   - nitter.net

   Extract @handles from tweets, then look them up on GitHub.

   If Nitter is hard to parse, use agent-browser:
   ```
   agent-browser navigate "https://nitter.poast.org/search?f=tweets&q=claude+code"
   agent-browser snapshot
   ```

4. **For each person, get their profile:**
   ```
   gh api users/{username} --jq '{login, name, company, location, bio, email, twitter_username, blog, followers}'
   ```

5. **REJECT if:**
   - Company contains: anthropic, vercel, openai, langchain, google, microsoft
   - They're a CEO/founder of a funded company
   - They're a student
   - They're a bot (actions-user, dependabot, etc.)

6. **KEEP if:**
   - Independent/freelance
   - At small startups
   - Has public email
   - Active in AI agent space

7. **Append good prospects to `prospects.txt`** with:
   - GitHub URL
   - Email
   - Twitter
   - Location
   - Why they're interesting
   - Signal strength (high/medium/low)

8. **Update the SOURCING LOG section** at the top of prospects.txt with:
   - Date checked
   - Who was rejected and why

---

## "Find more repos" means:

Find new high-signal AI/agent repos to source from.

1. **Search GitHub for trending AI agent repos:**
   ```
   gh search repos "AI agent" --sort=stars --limit=20
   gh search repos "coding agent" --sort=stars --limit=20
   gh search repos "LLM agent" --sort=stars --limit=20
   gh search repos "claude" --sort=updated --limit=20
   ```

2. **Check HN for Show HN posts about AI tools:**
   ```
   https://hn.algolia.com/api/v1/search?query=Show%20HN%20AI%20agent&tags=story
   https://hn.algolia.com/api/v1/search?query=Show%20HN%20coding%20assistant&tags=story
   ```

3. **Look at what prospects are starring/forking:**
   ```
   gh api users/{prospect}/starred --jq '.[].full_name' | head -20
   ```

4. **Check awesome lists:**
   - https://github.com/e2b-dev/awesome-ai-agents
   - https://github.com/kyrolabs/awesome-langchain

5. **Good repo signals:**
   - 500+ stars
   - Active in last 30 days
   - Multiple contributors (not just 1 person)
   - Related to: agents, coding assistants, LLM tools, MCP, sandboxes

6. **Add new repos to the list in step 1 above** (edit this file)
