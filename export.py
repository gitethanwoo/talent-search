#!/usr/bin/env python3
"""Export prospects.db to JSON for the dashboard."""

import sqlite3
import json
from pathlib import Path

DB = Path(__file__).parent / "prospects.db"
OUT = Path(__file__).parent / "dashboard" / "public" / "data.json"

def query(sql):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = [dict(r) for r in conn.execute(sql).fetchall()]
    conn.close()
    return rows

def scalar(sql):
    conn = sqlite3.connect(DB)
    result = conn.execute(sql).fetchone()[0]
    conn.close()
    return result

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
OUT.write_text(json.dumps(data, indent=2, default=str))
print(f"Exported to {OUT}")
