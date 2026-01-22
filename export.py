#!/usr/bin/env python3
"""Export prospects.db to JSON for the dashboard."""

import sqlite3
import json
from pathlib import Path

DB = Path(__file__).parent / "prospects.db"
OUT = Path(__file__).parent / "dashboard" / "public" / "data.json"

def get_connection():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def query(sql):
    conn = get_connection()
    rows = [dict(r) for r in conn.execute(sql).fetchall()]
    conn.close()
    return rows

def scalar(sql):
    conn = get_connection()
    result = conn.execute(sql).fetchone()[0]
    conn.close()
    return result


def generate_email_draft(prospect: dict) -> tuple[str, str]:
    """Generate personalized email subject and body for a prospect."""
    name = prospect['name'] or prospect['github_username']
    first_name = name.split()[0] if name else prospect['github_username']
    notes = prospect.get('notes') or ''

    subject = "Tenex Labs - AI Engineering Opportunity"

    body = f"""Hey {first_name},

I'm Alex Lieberman - I started Morning Brew and now I'm running Tenex Labs. Tenex is an AI dev agency where engineers get paid on output - story points completed equals dollars earned, uncapped. Top engineers here make $500K+.

I built a research agent to find strong candidates and your name came up"""

    # Personalize with notes if available
    if notes:
        body += f" - {notes}"
    else:
        body += "."

    body += """

Here's a short video explaining what we do if you want to learn more: [link]

Let me know if you'd like to talk.

Alex"""

    return subject, body


def generate_twitter_draft(prospect: dict) -> tuple[str, str]:
    """Generate personalized Twitter DM for a prospect."""
    name = prospect['name'] or prospect['github_username']
    first_name = name.split()[0] if name else prospect['github_username']
    notes = prospect.get('notes') or ''

    subject = "Tenex Labs Opportunity"

    # Twitter DMs need to be shorter
    body = f"""Hey {first_name} - I'm Alex from Tenex Labs. We're an AI dev agency where engineers get paid on output, uncapped. Top engineers make $500K+.

Your name came up in my research"""

    if notes:
        # Truncate notes for Twitter DM length
        short_notes = notes[:100] + "..." if len(notes) > 100 else notes
        body += f" - {short_notes}"
    else:
        body += "."

    body += """

Would love to chat if you're interested. Here's a quick video: [link]"""

    return subject, body


def generate_drafts():
    """Generate draft outreach messages for high-signal contactable prospects."""
    conn = get_connection()

    # Get high-signal prospects that are contactable (have email or twitter)
    prospects = conn.execute("""
        SELECT id, github_username, name, email, twitter, notes
        FROM prospects
        WHERE signal = 'high'
          AND (email IS NOT NULL OR twitter IS NOT NULL)
    """).fetchall()

    # Get existing drafts to avoid duplicates
    existing_drafts = set(
        row[0] for row in conn.execute(
            "SELECT prospect_id FROM outreach_messages WHERE status = 'draft'"
        ).fetchall()
    )

    drafts_created = 0

    for p in prospects:
        prospect = dict(p)
        prospect_id = prospect['id']

        # Skip if draft already exists
        if prospect_id in existing_drafts:
            continue

        # Determine channel and generate appropriate draft
        if prospect['email']:
            channel = 'email'
            subject, body = generate_email_draft(prospect)
        elif prospect['twitter']:
            channel = 'twitter'
            subject, body = generate_twitter_draft(prospect)
        else:
            continue

        # Insert draft
        conn.execute("""
            INSERT INTO outreach_messages (prospect_id, channel, message_type, subject, body, status)
            VALUES (?, ?, 'initial', ?, ?, 'draft')
        """, (prospect_id, channel, subject, body))

        drafts_created += 1

    conn.commit()
    conn.close()

    return drafts_created

data = {
    "stats": {
        "prospects": scalar("SELECT COUNT(*) FROM prospects"),
        "high_signal": scalar("SELECT COUNT(*) FROM prospects WHERE signal='high'"),
        "ships_fast": scalar("SELECT COUNT(*) FROM prospects WHERE ships_fast=1"),
        "ai_native": scalar("SELECT COUNT(*) FROM prospects WHERE ai_native=1"),
        "sources": scalar("SELECT COUNT(*) FROM sources_checked"),
        "rejected": scalar("SELECT COUNT(*) FROM rejected"),
    },
    "prospects": query("""
        SELECT id, github_username, name, email, twitter, location, company,
               signal, ships_fast, ai_native, source, outreach_status,
               notes, comp_fit, outreach_context, bio
        FROM prospects
        ORDER BY CASE signal WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                 ships_fast DESC
    """),
    "drafts": query("""
        SELECT m.id, p.github_username, p.name, p.email, p.twitter,
               m.subject, m.body, m.channel, m.status, m.created_at
        FROM outreach_messages m
        JOIN prospects p ON p.id = m.prospect_id
        ORDER BY m.created_at DESC
    """),
    "sources": query("""
        SELECT source_type, source_name, checked_at
        FROM sources_checked
        ORDER BY checked_at DESC
    """),
}

OUT.parent.mkdir(parents=True, exist_ok=True)

# Generate drafts for high-signal prospects before exporting
drafts_created = generate_drafts()

# Re-query drafts after generating new ones
data["drafts"] = query("""
    SELECT m.id, p.github_username, p.name, p.email, p.twitter,
           m.subject, m.body, m.channel, m.status, m.created_at
    FROM outreach_messages m
    JOIN prospects p ON p.id = m.prospect_id
    ORDER BY m.created_at DESC
""")

OUT.write_text(json.dumps(data, indent=2, default=str))
print(f"Exported to {OUT}")
if drafts_created > 0:
    print(f"Generated {drafts_created} new draft(s)")
