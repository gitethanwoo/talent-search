#!/usr/bin/env python3
"""Generate and open prospects dashboard."""

import sqlite3
import json
import webbrowser
import urllib.parse
from pathlib import Path

DB = Path(__file__).parent / "prospects.db"
OUT = Path(__file__).parent / "dashboard.html"

def query(sql):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.execute(sql)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def scalar(sql):
    conn = sqlite3.connect(DB)
    result = conn.execute(sql).fetchone()[0]
    conn.close()
    return result

def mailto(to, subject, body):
    return f"mailto:{to}?subject={urllib.parse.quote(subject or '')}&body={urllib.parse.quote(body or '')}"

# Gather data
data = {
    "stats": {
        "prospects": scalar("SELECT COUNT(*) FROM prospects"),
        "high_signal": scalar("SELECT COUNT(*) FROM prospects WHERE signal='high'"),
        "ships_fast": scalar("SELECT COUNT(*) FROM prospects WHERE ships_fast=1"),
        "ai_native": scalar("SELECT COUNT(*) FROM prospects WHERE ai_native=1"),
        "sources": scalar("SELECT COUNT(*) FROM sources_checked"),
        "rejected": scalar("SELECT COUNT(*) FROM rejected"),
    },
    "high_signal": query("""
        SELECT github_username, name, email, twitter, ships_fast, ai_native, source
        FROM prospects WHERE signal='high' ORDER BY ships_fast DESC
    """),
    "outreach": query("""
        SELECT p.github_username, p.name, p.outreach_status, m.subject, m.status as msg_status, m.created_at
        FROM prospects p
        JOIN outreach_messages m ON p.id = m.prospect_id
        ORDER BY m.created_at DESC
    """),
    "all_prospects": query("""
        SELECT github_username, name, email, signal, ships_fast, ai_native, source
        FROM prospects ORDER BY
            CASE signal WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            ships_fast DESC
    """),
    "drafts": query("""
        SELECT p.github_username, p.name, p.email, p.twitter, m.subject, m.body, m.channel, m.created_at
        FROM outreach_messages m
        JOIN prospects p ON p.id = m.prospect_id
        WHERE m.status = 'draft'
        ORDER BY m.created_at DESC
    """),
}

html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tenex Prospects</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {{
      theme: {{
        extend: {{
          colors: {{ dark: '#0a0a0a' }}
        }}
      }}
    }}
  </script>
</head>
<body class="bg-dark text-gray-100 min-h-screen p-8">
  <div class="max-w-7xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">Tenex Prospects</h1>

    <!-- Stats -->
    <div class="grid grid-cols-6 gap-4 mb-10">
      <div class="bg-zinc-900 rounded-lg p-4">
        <div class="text-3xl font-bold">{data["stats"]["prospects"]}</div>
        <div class="text-zinc-500 text-sm">Prospects</div>
      </div>
      <div class="bg-zinc-900 rounded-lg p-4">
        <div class="text-3xl font-bold text-green-400">{data["stats"]["high_signal"]}</div>
        <div class="text-zinc-500 text-sm">High Signal</div>
      </div>
      <div class="bg-zinc-900 rounded-lg p-4">
        <div class="text-3xl font-bold text-blue-400">{data["stats"]["ships_fast"]}</div>
        <div class="text-zinc-500 text-sm">Ships Fast</div>
      </div>
      <div class="bg-zinc-900 rounded-lg p-4">
        <div class="text-3xl font-bold text-purple-400">{data["stats"]["ai_native"]}</div>
        <div class="text-zinc-500 text-sm">AI Native</div>
      </div>
      <div class="bg-zinc-900 rounded-lg p-4">
        <div class="text-3xl font-bold">{data["stats"]["sources"]}</div>
        <div class="text-zinc-500 text-sm">Sources</div>
      </div>
      <div class="bg-zinc-900 rounded-lg p-4">
        <div class="text-3xl font-bold text-zinc-500">{data["stats"]["rejected"]}</div>
        <div class="text-zinc-500 text-sm">Rejected</div>
      </div>
    </div>

    <!-- Draft Messages -->
    <h2 class="text-xl font-semibold mb-4">Draft Messages ({len(data["drafts"])})</h2>
    <div class="space-y-2 mb-10">
      {"".join(f'''<details class="bg-zinc-900 rounded-lg">
        <summary class="p-3 cursor-pointer hover:bg-zinc-800 rounded-lg flex justify-between items-center">
          <div>
            <span class="font-semibold">{r["name"] or r["github_username"]}</span>
            <span class="text-zinc-500 mx-2">—</span>
            <span class="text-zinc-400">{r["subject"]}</span>
          </div>
          <div class="flex gap-2">
            <span class="px-2 py-1 rounded text-xs bg-zinc-700">{r["channel"]}</span>
            {f'<a href="{mailto(r["email"], r["subject"], r["body"])}" class="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white no-underline">Email ↗</a>' if r["email"] else f'<a href="https://twitter.com/{r["twitter"].replace("@", "")}" target="_blank" class="px-3 py-1 rounded text-xs bg-sky-600 hover:bg-sky-500 text-white no-underline">DM on X ↗</a>' if r["twitter"] else '<span class="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-500">no contact</span>'}
          </div>
        </summary>
        <div class="p-4 pt-0">
          <div class="text-zinc-500 text-xs mb-2">{r["email"] or "no email"}</div>
          <div class="bg-zinc-800 rounded p-3 text-sm whitespace-pre-wrap">{r["body"]}</div>
        </div>
      </details>''' for r in data["drafts"]) or '<div class="bg-zinc-900 rounded-lg p-4 text-zinc-500">No drafts</div>'}
    </div>

    <!-- Outreach Pipeline -->
    <h2 class="text-xl font-semibold mb-4">Outreach Pipeline</h2>
    <div class="bg-zinc-900 rounded-lg overflow-hidden mb-10">
      <table class="w-full text-sm">
        <thead class="bg-zinc-800">
          <tr>
            <th class="text-left p-3">Name</th>
            <th class="text-left p-3">Status</th>
            <th class="text-left p-3">Subject</th>
            <th class="text-left p-3">Message</th>
          </tr>
        </thead>
        <tbody>
          {"".join(f'''<tr class="border-t border-zinc-800 hover:bg-zinc-800/50">
            <td class="p-3"><a href="https://github.com/{r["github_username"]}" class="text-blue-400 hover:underline">{r["name"] or r["github_username"]}</a></td>
            <td class="p-3"><span class="px-2 py-1 rounded text-xs bg-zinc-700">{r["outreach_status"]}</span></td>
            <td class="p-3">{r["subject"] or ""}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-xs bg-zinc-700">{r["msg_status"] or ""}</span></td>
          </tr>''' for r in data["outreach"]) or '<tr><td colspan="4" class="p-3 text-zinc-500">No outreach yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- High Signal -->
    <h2 class="text-xl font-semibold mb-4">High Signal Prospects</h2>
    <div class="bg-zinc-900 rounded-lg overflow-hidden mb-10">
      <table class="w-full text-sm">
        <thead class="bg-zinc-800">
          <tr>
            <th class="text-left p-3">GitHub</th>
            <th class="text-left p-3">Name</th>
            <th class="text-left p-3">Email</th>
            <th class="text-left p-3">Twitter</th>
            <th class="text-center p-3">Fast</th>
            <th class="text-center p-3">AI</th>
            <th class="text-left p-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {"".join(f'''<tr class="border-t border-zinc-800 hover:bg-zinc-800/50">
            <td class="p-3"><a href="https://github.com/{r["github_username"]}" class="text-blue-400 hover:underline">{r["github_username"]}</a></td>
            <td class="p-3">{r["name"] or ""}</td>
            <td class="p-3">{f'<a href="mailto:{r["email"]}" class="text-blue-400 hover:underline">{r["email"]}</a>' if r["email"] else ""}</td>
            <td class="p-3">{f'<a href="https://twitter.com/{r["twitter"].replace("@", "")}" class="text-blue-400 hover:underline">{r["twitter"]}</a>' if r["twitter"] else ""}</td>
            <td class="p-3 text-center">{("✓" if r["ships_fast"] else "")}</td>
            <td class="p-3 text-center">{("✓" if r["ai_native"] else "")}</td>
            <td class="p-3 text-zinc-400 text-xs">{r["source"] or ""}</td>
          </tr>''' for r in data["high_signal"])}
        </tbody>
      </table>
    </div>

    <!-- All Prospects -->
    <h2 class="text-xl font-semibold mb-4">All Prospects ({len(data["all_prospects"])})</h2>
    <div class="bg-zinc-900 rounded-lg overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-zinc-800">
          <tr>
            <th class="text-left p-3">GitHub</th>
            <th class="text-left p-3">Name</th>
            <th class="text-left p-3">Email</th>
            <th class="text-left p-3">Signal</th>
            <th class="text-center p-3">Fast</th>
            <th class="text-center p-3">AI</th>
            <th class="text-left p-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {"".join(f'''<tr class="border-t border-zinc-800 hover:bg-zinc-800/50">
            <td class="p-3"><a href="https://github.com/{r["github_username"]}" class="text-blue-400 hover:underline">{r["github_username"]}</a></td>
            <td class="p-3">{r["name"] or ""}</td>
            <td class="p-3">{f'<a href="mailto:{r["email"]}" class="text-blue-400 hover:underline">{r["email"]}</a>' if r["email"] else ""}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-xs {"bg-green-900 text-green-300" if r["signal"]=="high" else "bg-yellow-900 text-yellow-300" if r["signal"]=="medium" else "bg-zinc-700"}">{r["signal"]}</span></td>
            <td class="p-3 text-center">{("✓" if r["ships_fast"] else "")}</td>
            <td class="p-3 text-center">{("✓" if r["ai_native"] else "")}</td>
            <td class="p-3 text-zinc-400 text-xs">{r["source"] or ""}</td>
          </tr>''' for r in data["all_prospects"])}
        </tbody>
      </table>
    </div>

    <div class="text-zinc-600 text-sm mt-8">Generated by view.py</div>
  </div>
</body>
</html>'''

OUT.write_text(html)
webbrowser.open(f"file://{OUT.absolute()}")
print(f"Opened {OUT}")
