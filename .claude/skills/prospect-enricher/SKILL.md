---
name: prospect-enricher
description: Deep research to enrich prospect profiles with contact info, verification, and outreach context. Use when asked to "enrich prospects", "research this person", "find contact info", "get me emails", or "prepare for outreach". Runs exhaustive checklist for each prospect.
---

# Prospect Enricher

Exhaustive research to fill in everything we need for personalized outreach.

## Database: prospects.db

```sql
-- Enrichment fields
email, twitter, linkedin_url, personal_site, blog,
location, company, bio,
ships_fast, ai_native, portfolio, comp_fit,
outreach_context, enriched_at
```

## The Checklist

For each prospect, work through EVERY item. Use TodoWrite to track progress. Mark each as done with what was found (or "not found" if exhausted all options).

### 1. Contact Info

**Email** (CRITICAL)
- [ ] Check GitHub profile: `gh api users/{username} --jq '.email'`
- [ ] Check GitHub commit emails: `gh api users/{username}/events --jq '.[].payload.commits[]?.author.email' | head -5`
- [ ] Check personal website/blog contact page
- [ ] Google: `"{name}" email`
- [ ] Google: `"{github_username}" email`
- [ ] Check Twitter bio for email
- [ ] Check LinkedIn about section (if found)
- [ ] Look for newsletter signup (author's email often visible)
- [ ] Check conference talk listings (speakers have contact)

**LinkedIn URL**
- [ ] Google: `"{name}" "{company}" site:linkedin.com`
- [ ] Google: `"{name}" {location} site:linkedin.com`
- [ ] Check Twitter bio for LinkedIn link
- [ ] Check GitHub profile for LinkedIn link
- [ ] Check personal website for LinkedIn link

**Twitter/X**
- [ ] Check GitHub profile: `gh api users/{username} --jq '.twitter_username'`
- [ ] Google: `"{name}" site:twitter.com` or `site:x.com`
- [ ] Check LinkedIn for Twitter link

**Personal Website**
- [ ] Check GitHub profile: `gh api users/{username} --jq '.blog'`
- [ ] Check Twitter bio
- [ ] Google: `"{name}" {company} website`
- [ ] Check LinkedIn for website link
- [ ] Look for {username}.com, {username}.dev, {username}.io

### 2. Verification

**Current Status**
- [ ] Verify company/role is current (check LinkedIn, Twitter bio)
- [ ] Check if actively coding: recent GitHub commits?
- [ ] Check if actively posting: recent tweets?
- [ ] Confirm location (or if remote-friendly)

**Still Available?**
- [ ] Any recent "just joined..." announcements? (skip if just took new job)
- [ ] Any "hiring" posts? (might be manager, not IC)
- [ ] Any "not looking" signals?

### 3. Signal Validation

**ships_fast Evidence**
- [ ] Find specific examples of rapid building
- [ ] Weekend projects, hackathons, "built in X days" posts
- [ ] Commit frequency on GitHub
- [ ] Number of shipped projects
- [ ] Update `portfolio` field with links

**ai_native Evidence**
- [ ] Mentions of Claude, Cursor, Copilot in tweets/posts
- [ ] AI-related repos or contributions
- [ ] Blog posts about AI tooling
- [ ] Conference talks on AI coding

**comp_fit Reasoning**
- [ ] Why would uncapped performance pay appeal?
- [ ] Freelancer background?
- [ ] History of high output?
- [ ] Any frustration with traditional roles?

### 4. Outreach Context

**What to personalize on:**
- [ ] What are they working on RIGHT NOW?
- [ ] Recent blog posts or tweets (topics they care about)
- [ ] Projects they're proud of (mention specifically)
- [ ] Shared interests or connections
- [ ] Why TeneX specifically fits them

**Best outreach channel:**
- [ ] Email (if have it) - usually best
- [ ] Twitter DM (if active on Twitter)
- [ ] LinkedIn (last resort)

---

## Running Enrichment

**Single prospect:**
```bash
sqlite3 -header -column prospects.db "SELECT * FROM prospects WHERE github_username='{username}'"
```

**Batch - unenriched high-signal prospects:**
```bash
sqlite3 -header -column prospects.db "SELECT github_username, name, email, signal FROM prospects WHERE enriched_at IS NULL AND (signal='high' OR ships_fast=1) ORDER BY signal"
```

**After enrichment, update:**
```bash
sqlite3 prospects.db "UPDATE prospects SET
  email='{email}',
  linkedin_url='{url}',
  personal_site='{site}',
  portfolio='{links}',
  comp_fit='{reasoning}',
  outreach_context='{context}',
  enriched_at=datetime('now')
WHERE github_username='{username}'"
```

---

## Web Search Patterns

```
# Email finding
"{full name}" email
"{github username}" contact
"{name}" "{company}" email

# LinkedIn
"{name}" "{company}" site:linkedin.com
"{name}" "{location}" engineer site:linkedin.com

# Twitter
"{name}" site:twitter.com OR site:x.com
"{github username}" twitter

# Personal site
"{name}" blog
"{name}" portfolio
{username}.dev OR {username}.io OR {username}.com

# Recent activity
"{name}" "{current year}" (to find recent content)
"{name}" conference talk speaker
"{name}" podcast guest
```

---

## Output

After completing checklist, summarize:

```
## {Name} (@{github}) - Enrichment Complete

**Contact:**
- Email: {found/not found}
- LinkedIn: {url or not found}
- Twitter: {handle or not found}
- Personal site: {url or not found}

**Verified:**
- Current role: {company/role}
- Active: {yes/no - last activity}
- Available: {yes/no/unknown}

**Signals:**
- ships_fast: {evidence}
- ai_native: {evidence}
- comp_fit: {reasoning}

**Outreach angle:**
{Personalized hook based on research}

**Best channel:** {email/twitter/linkedin}
```
