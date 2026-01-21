"""
E2B test: Spin up sandbox, install Claude Agent SDK, run sourcing task.
"""

import os
from e2b_code_interpreter import Sandbox

SOURCING_SCRIPT = '''
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

PROMPT = """
Search Hacker News for posts about "agent-browser" using the Algolia API.

Use WebFetch to call:
https://hn.algolia.com/api/v1/search?query=agent-browser&tags=story

Extract the top 5 stories with: title, author (HN username), points, url.

Output as JSON to stdout (just print the JSON, nothing else).
"""

async def main():
    async for message in query(
        prompt=PROMPT,
        options=ClaudeAgentOptions(
            allowed_tools=["WebFetch", "Bash"],
            permission_mode="bypassPermissions",
            model="haiku",
            max_turns=10,
        )
    ):
        if hasattr(message, 'content'):
            for block in message.content:
                if hasattr(block, 'text') and block.text.strip():
                    print(block.text)

asyncio.run(main())
'''

def main():
    print("=" * 60)
    print("E2B Sandbox Test: HN Search (No Auth Required)")
    print("=" * 60)

    if not os.environ.get("E2B_API_KEY"):
        print("\nERROR: E2B_API_KEY not set")
        return

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("\nERROR: ANTHROPIC_API_KEY not set")
        return

    anthropic_key = os.environ["ANTHROPIC_API_KEY"]

    print("\n[1/4] Creating E2B sandbox...")
    sbx = Sandbox.create(timeout=300)  # 5 min timeout

    try:
        print(f"      Sandbox ID: {sbx.sandbox_id}")

        print("\n[2/4] Installing Claude Agent SDK...")

        # Install Claude Code first
        result = sbx.commands.run(
            "curl -fsSL https://claude.ai/install.sh | bash",
            timeout=120
        )
        if result.exit_code != 0:
            print(f"      Claude Code install failed: {result.stderr}")
            return
        print("      Claude Code: OK")

        # Install SDK
        result = sbx.commands.run("pip install claude-agent-sdk", timeout=60)
        print(f"      SDK: {'OK' if result.exit_code == 0 else 'FAILED'}")

        print("\n[3/4] Writing agent script...")
        sbx.files.write("/home/user/agent.py", SOURCING_SCRIPT)

        print("\n[4/4] Running agent (searching HN for agent-browser)...")
        result = sbx.commands.run(
            f"ANTHROPIC_API_KEY={anthropic_key} python /home/user/agent.py",
            timeout=120
        )

        print("\n" + "=" * 60)
        print("AGENT OUTPUT:")
        print("=" * 60)
        print(result.stdout or "(no stdout)")

        if result.stderr:
            print("\nErrors:", result.stderr[:500])

    finally:
        print("\n[Cleanup] Destroying sandbox...")
        sbx.kill()
        print("Done.")

if __name__ == "__main__":
    main()
