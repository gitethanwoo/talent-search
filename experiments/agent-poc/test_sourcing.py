"""
Minimal proof of concept: Can Claude Agent SDK produce good sourcing results?

Task: Find the top 5 contributors to vercel-labs/agent-browser,
get their profiles and emails, output as JSON.
"""

import asyncio
import json
from claude_agent_sdk import query, ClaudeAgentOptions

SOURCING_PROMPT = """
Find the top 5 contributors to vercel-labs/agent-browser using the gh CLI.

For each:
1. Get their GitHub username
2. Get their profile (name, email, company, location, bio, twitter)
3. Get email from commit history if not in profile
4. Note their contributions

Use `gh` commands like:
- gh api repos/vercel-labs/agent-browser/contributors
- gh api users/USERNAME
- gh api repos/vercel-labs/agent-browser/commits --jq '.[] | select(.author.login == "USERNAME") | .commit.author.email'

Save results to leads.json as:
{
  "leads": [
    {
      "username": "...",
      "name": "...",
      "email": "...",
      "company": "...",
      "contributions": "..."
    }
  ]
}
"""

async def main():
    print("Starting sourcing agent...")
    print("=" * 50)

    async for message in query(
        prompt=SOURCING_PROMPT,
        options=ClaudeAgentOptions(
            allowed_tools=["Bash", "Write", "Read"],
            permission_mode="bypassPermissions",
            model="sonnet",
            max_turns=30,
        )
    ):
        # Debug: print every message type
        print(f"\n[MSG TYPE]: {type(message).__name__}")
        print(f"[MSG]: {str(message)[:500]}")

    print("\n" + "=" * 50)
    print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
