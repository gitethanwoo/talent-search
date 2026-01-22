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

## Tenex Context

**Read [references/tenex-pitch.md](references/tenex-pitch.md) for full pitch details, objection handling, and hooks.**

### Quick Summary

Tenex = AI-powered dev agency, but different:
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
   - Which Tenex hook fits them? (variety? meritocracy? elite peers? AI-native?)
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
1. **The specific signal** that flagged them (from enrichment data)
2. **Link to video** for more info
3. **Clear next step** - "let me know if you'd like to talk"

### The Approach: Radical Transparency

**Don't:**
- Pretend you used their project ("been using claude-flow daily!")
- Fake familiarity or warmth
- Use AI-tell words: "impressive", "clearly", "elegant"
- Write in staccato (every sentence its own paragraph)
- Try to sound casual ("figured I'd reach out", "no pressure")
- Over-explain or be artificially concise

**Do:**
- Be honest that a research agent found them
- State the actual signal that flagged them
- Write in natural paragraphs like a real email
- Be direct and confident, not deferential
- Link to videos instead of walls of text
- Let the process be the pitch (AI-native company uses AI to recruit)

### Email Template

```
Subject: Tenex Labs

Hey [first name],

I'm Alex Lieberman - I started Morning Brew and now I'm running Tenex Labs. Tenex is an AI dev agency where engineers get paid on output - story points completed equals dollars earned, uncapped. Top engineers here make $500K+.

I built a research agent to find strong candidates and your name came up because [specific reason from enrichment - e.g. "you've shipped three AI tools in the past year" or "your work on X showed up in our search for engineers building with Claude"]. Here's a short video explaining what we do if you want to learn more: [link]

Let me know if you'd like to talk.

Alex
```

### Twitter DM Template

```
Hey - I'm Alex from Tenex Labs. Built a research agent to find engineers and your name came up because [reason]. We're an AI dev agency with uncapped comp based on output. Here's a quick video if you're curious: [link]
```

### Follow-up 1 (3-4 days)

```
Subject: Re: Tenex Labs

Hey [first name],

Wanted to bump this in case it got buried. Short version: AI dev agency, pay based on output, uncapped. Video here if you want to learn more: [link]

Alex
```

### Follow-up 2 (7 days)

```
Subject: Re: Tenex Labs

Last one from me. If the timing isn't right, totally understand. But if you're ever curious what output-based comp actually looks like, the offer stands: [link]

Alex
```

### What Makes This Work

1. **Honesty is differentiating** - "I built a research agent" is interesting, not creepy
2. **The process is the pitch** - an AI company using AI to recruit signals competence
3. **Videos do the heavy lifting** - don't explain everything in the email
4. **Specific signal** - "your name came up because X" shows it's not spam
5. **Natural paragraphs** - reads like a human wrote it because it flows like speech
6. **Confident, not desperate** - states facts, offers next step, doesn't beg

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

## Follow-ups

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
