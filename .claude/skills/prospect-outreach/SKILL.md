---
name: prospect-outreach
description: Generate personalized outreach messages and track campaign status. Use when asked to "draft outreach", "write a message to", "contact prospects", "check outreach status", "who needs follow-up", or "generate follow-ups".
---

# Prospect Outreach

Generate personalized messages. Track the funnel.

## Database

```sql
outreach_messages (
  id, prospect_id, channel, message_type,
  subject, body, status, created_at, sent_at
)
-- status: draft → approved → sent → replied
-- message_type: initial, followup_1, followup_2, followup_3

prospects.outreach_status  -- not_contacted → in_progress → replied → interested → closed
prospects.last_contacted_at
```

## Quick Commands

```bash
# Outreach pipeline
sqlite3 -header -column prospects.db "
SELECT outreach_status, COUNT(*) as count
FROM prospects GROUP BY outreach_status"

# Ready to contact (enriched, not contacted)
sqlite3 -header -column prospects.db "
SELECT github_username, name, email, signal
FROM prospects
WHERE enriched_at IS NOT NULL
AND outreach_status = 'not_contacted'
AND email IS NOT NULL
ORDER BY signal"

# Drafts ready to send
sqlite3 -header -column prospects.db "
SELECT p.name, m.channel, m.subject, m.status
FROM outreach_messages m
JOIN prospects p ON p.id = m.prospect_id
WHERE m.status = 'draft'"

# Needs follow-up (sent 3+ days ago, no reply)
sqlite3 -header -column prospects.db "
SELECT p.github_username, p.name, m.sent_at, m.message_type
FROM prospects p
JOIN outreach_messages m ON p.id = m.prospect_id
WHERE m.status = 'sent'
AND m.sent_at < datetime('now', '-3 days')
AND p.outreach_status = 'in_progress'
ORDER BY m.sent_at"
```

---

## TeneX Context

**Read [references/tenex-pitch.md](references/tenex-pitch.md) for full pitch details, objection handling, and hooks.**

### Quick Summary

TeneX = AI-powered dev agency, but different:
- Hire the best (not cheap talent)
- Charge clients on outcomes (story points)
- Pay engineers on outcomes (story points = $, uncapped)
- $250K-$800K+ based on output
- In-office NYC, intense culture ("Navy SEALs")

**The hooks (pick based on prospect):**
- **Frustrated by slow companies** → outcomes-based, no bureaucracy
- **Underpaid relative to output** → story points = dollars, meritocracy
- **Tired of carrying mediocre teammates** → we only hire the best
- **Bored of one product** → diverse clients, different problems
- **AI-native** → everyone uses AI tools, build custom automations
- **High performers wanting ownership** → your ceiling = your output

---

## Message Generation

### How to Generate a Message

1. **Read prospect's enrichment data:**
   - `outreach_context` - the hook, timing notes
   - `portfolio` - what they've built
   - `comp_fit` - why uncapped pay appeals to them

2. **Pick the strongest hook from their context:**
   - What specific project/tweet/post to reference?
   - Which TeneX hook fits them? (variety? meritocracy? elite peers? AI-native?)
   - What's their likely objection? (intensity? NYC? too good to be true?)

3. **Draft using structure:**
   - Line 1: Specific reference to their work + genuine reaction
   - Line 2-3: The pitch (tailored hook, not generic)
   - Line 4: Why them specifically
   - Line 5: Soft CTA

4. **Self-check before saving:**
   - [ ] Is there a SPECIFIC reference? (project name, not "your work")
   - [ ] Is the hook tailored to them? (not just "uncapped pay")
   - [ ] Under 100 words?
   - [ ] Sounds human, not templated?
   - [ ] Would YOU reply to this?

### Tone by Channel

**Email:** Professional but direct. 3-5 sentences max. Personal hook → value prop → soft CTA.

**Twitter DM:** Casual, short. 2-3 sentences. Reference their work → intriguing hook → ask to chat.

**LinkedIn:** Slightly more formal. Still concise. Reference shared context → opportunity → CTA.

### Personalization Requirements

Every message MUST include:
1. **Specific reference** to their work (project name, tweet, blog post)
2. **Why them** - what signals made us reach out
3. **The hook** - uncapped pay, ship fast, AI-native
4. **Soft CTA** - "worth a conversation?" not "apply now"

### Message Templates

**Email - Initial (adapt based on their hook):**
```
Subject: [Their project] + something different

Hey [First name],

[Specific project/tweet] caught my eye - [genuine 1-line reaction].

Building TeneX: AI dev agency where engineers get paid on output.
Story points = dollars, uncapped. Best people here clear $500K+.
[Insert tailored hook: variety of problems / elite peers / AI-native culture / meritocracy]

[Why them specifically based on signals].

Worth a quick chat?
```

**Twitter DM - Initial:**
```
[Project/tweet] is sick. [1-line genuine reaction].

Hiring at TeneX - AI dev agency, uncapped comp based on output.
[One tailored hook]. Open to hearing more?
```

**Email - Follow-up 1 (3 days):**
```
Subject: Re: [original subject]

Floating this back up. Know you're busy shipping.

Quick version: diverse client problems, AI-native team,
paid directly for output. No politics, no ceiling.

If timing's off, no worries. But if you're curious
what uncapped actually looks like, happy to share.
```

**Email - Follow-up 2 (7 days):**
```
Subject: Re: [original subject]

Last ping.

If [their current thing] has you locked in, totally get it.
But if you ever want to work with people at your level
and get paid for what you actually ship - door's open.
```

### Example Messages (for reference)

**For an AI-native builder (hook: elite peers + AI-native):**
```
Subject: claude-flow + something different

Hey rUv,

claude-flow is impressive - 163 repos and you're building the orchestration
layer everyone needs. Clearly shipping faster than most teams.

Building TeneX: AI dev agency where everyone uses Claude/Cursor daily.
Comp is uncapped, based on story points. Best engineers clear $500K+.
You'd be working alongside people who actually get AI-native workflows.

Seems like you'd fit. Worth a chat?
```

**For someone bored of one product (hook: variety):**
```
Subject: quick question

Hey [name],

Saw you've been at [company] for 3 years on [product].
Impressive depth, but wondering if you ever miss variety.

TeneX: different clients, different problems every few months.
Startups, market leaders, AI products. Paid on output, uncapped.

If you're happy where you are, ignore this. But if you want
diverse problems with elite engineers - let's talk.
```

---

## Workflow

### Draft Initial Outreach

```bash
# 1. Get prospect details
sqlite3 -header -column prospects.db "
SELECT id, github_username, name, email, twitter, company,
       portfolio, comp_fit, outreach_context
FROM prospects WHERE github_username = '{username}'"

# 2. Generate personalized message using their context

# 3. Save draft
sqlite3 prospects.db "
INSERT INTO outreach_messages (prospect_id, channel, message_type, subject, body)
VALUES (
  (SELECT id FROM prospects WHERE github_username='{username}'),
  'email',
  'initial',
  '{subject}',
  '{body}'
)"

# 4. Update prospect status
sqlite3 prospects.db "
UPDATE prospects SET outreach_status = 'in_progress'
WHERE github_username = '{username}'"
```

### Mark as Sent

```bash
sqlite3 prospects.db "
UPDATE outreach_messages SET status = 'sent', sent_at = datetime('now')
WHERE id = {message_id}"

sqlite3 prospects.db "
UPDATE prospects SET last_contacted_at = datetime('now')
WHERE id = {prospect_id}"
```

### Record Reply

```bash
# Mark message as replied
sqlite3 prospects.db "
UPDATE outreach_messages SET status = 'replied'
WHERE id = {message_id}"

# Update prospect status
sqlite3 prospects.db "
UPDATE prospects SET outreach_status = 'replied'
WHERE id = {prospect_id}"
```

### Record Interest / Close

```bash
# Interested - they want to learn more
sqlite3 prospects.db "
UPDATE prospects SET outreach_status = 'interested'
WHERE github_username = '{username}'"

# Closed - either hired, rejected, or not interested
sqlite3 prospects.db "
UPDATE prospects SET outreach_status = 'closed'
WHERE github_username = '{username}'"
```

---

## Batch Operations

### Draft for all ready prospects

```bash
# Get all enriched, not contacted, with email
sqlite3 -header -column prospects.db "
SELECT id, github_username, name, email, portfolio, comp_fit, outreach_context
FROM prospects
WHERE enriched_at IS NOT NULL
AND outreach_status = 'not_contacted'
AND email IS NOT NULL
ORDER BY signal DESC"
```

Then generate personalized message for each.

### Generate follow-ups

```bash
# Find who needs follow-up
sqlite3 -header -column prospects.db "
SELECT p.id, p.github_username, p.name, p.email,
       m.message_type, m.sent_at
FROM prospects p
JOIN outreach_messages m ON p.id = m.prospect_id
WHERE m.status = 'sent'
AND p.outreach_status = 'in_progress'
AND m.sent_at < datetime('now', '-3 days')
AND m.message_type = 'initial'
AND NOT EXISTS (
  SELECT 1 FROM outreach_messages m2
  WHERE m2.prospect_id = p.id AND m2.message_type = 'followup_1'
)"
```

---

## View Message

```bash
sqlite3 -header -column prospects.db "
SELECT p.name, m.channel, m.message_type, m.subject, m.body, m.status, m.created_at
FROM outreach_messages m
JOIN prospects p ON p.id = m.prospect_id
WHERE m.id = {message_id}"
```
