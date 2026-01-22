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

## Message Generation

### The TeneX Pitch

**What we offer:**
- Uncapped performance-based pay (story points = dollars)
- "Make $1M/year if you're insane"
- Small, efficient team shipping fast
- AI-native workflows (Claude, Cursor, etc.)
- Ownership and autonomy

**Who we want:**
- Ships fast, high velocity
- AI-native (uses modern tools)
- Wants to control their destiny
- Not looking for corporate comfort

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

**Email - Initial:**
```
Subject: [Their project] + an unusual opportunity

Hey [First name],

Saw [specific project/tweet/post] - [genuine 1-line reaction].

I'm hiring for TeneX. Unusual model: uncapped performance pay.
Story points closed = dollars earned. Best engineers here will clear $500K+.

Looking for people who ship fast and want to own their output.
Based on [specific signal], seems like that might be you.

Worth a quick chat?

[Your name]
```

**Twitter DM - Initial:**
```
Hey - saw [project/tweet]. [1-line genuine reaction].

Building something at TeneX with uncapped performance pay
(story points = $). Looking for fast shippers.

Open to hearing more?
```

**Email - Follow-up 1 (3 days):**
```
Subject: Re: [original subject]

Hey [First name],

Floating this back up. Know you're busy shipping.

The offer: work with a small team, AI-native stack,
and get paid directly for output. No politics, no ceiling.

If timing's wrong, no worries. But if you're curious,
happy to share more about what we're building.

[Your name]
```

**Email - Follow-up 2 (7 days):**
```
Subject: Re: [original subject]

Last ping, promise.

If [company/project they're working on] has you locked in,
totally get it. But if you ever want to talk about
what "uncapped" actually looks like in practice, door's open.

[Your name]
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
