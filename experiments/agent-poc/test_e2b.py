"""
Test: Can we run the Claude Agent SDK inside an E2B sandbox?

This proves the core architecture:
1. Spin up ephemeral sandbox
2. Install dependencies
3. Run sourcing agent
4. Get results
5. Tear down

Requirements:
- export E2B_API_KEY=your_key
- export ANTHROPIC_API_KEY=your_key
"""

import asyncio
import os
from e2b_code_interpreter import Sandbox

# The sourcing script we'll run inside the sandbox
SOURCING_SCRIPT = '''
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

PROMPT = """
Find the top 3 contributors to vercel-labs/agent-browser using gh CLI.
For each, get: username, name, email (from profile or commits), company, twitter.
Output as JSON to stdout.
"""

async def main():
    result = None
    async for message in query(
        prompt=PROMPT,
        options=ClaudeAgentOptions(
            allowed_tools=["Bash"],
            permission_mode="bypassPermissions",
            model="haiku",  # Use haiku for speed/cost in sandbox
            max_turns=20,
        )
    ):
        if hasattr(message, 'content'):
            for block in message.content:
                if hasattr(block, 'text'):
                    result = block.text

    print("RESULT:", result)

asyncio.run(main())
'''

async def main():
    print("=" * 60)
    print("E2B Sandbox Test: Claude Agent SDK for Sourcing")
    print("=" * 60)

    # Check for required env vars
    if not os.environ.get("E2B_API_KEY"):
        print("\nERROR: E2B_API_KEY not set")
        print("Get yours at https://e2b.dev")
        return

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("\nERROR: ANTHROPIC_API_KEY not set")
        return

    anthropic_key = os.environ["ANTHROPIC_API_KEY"]

    print("\n[1/5] Creating E2B sandbox...")
    sbx = Sandbox(timeout=300)  # 5 min timeout

    try:
        print(f"      Sandbox ID: {sbx.sandbox_id}")

        print("\n[2/5] Installing dependencies...")

        # Install Claude Code CLI
        result = sbx.commands.run("curl -fsSL https://claude.ai/install.sh | bash")
        print(f"      Claude Code: {'OK' if result.exit_code == 0 else 'FAILED'}")

        # Install Python SDK
        result = sbx.commands.run("pip install claude-agent-sdk")
        print(f"      SDK: {'OK' if result.exit_code == 0 else 'FAILED'}")

        # Install GitHub CLI
        result = sbx.commands.run("apt-get update && apt-get install -y gh")
        print(f"      gh CLI: {'OK' if result.exit_code == 0 else 'FAILED'}")

        print("\n[3/5] Setting up authentication...")

        # Set Anthropic API key
        sbx.commands.run(f"export ANTHROPIC_API_KEY={anthropic_key}")

        # Note: gh CLI auth would need a token, skipping for this test
        # In production, you'd pass a GH_TOKEN

        print("\n[4/5] Writing sourcing script...")
        sbx.files.write("/home/user/sourcing.py", SOURCING_SCRIPT)

        print("\n[5/5] Running sourcing agent...")
        result = sbx.commands.run(
            f"ANTHROPIC_API_KEY={anthropic_key} python /home/user/sourcing.py",
            timeout=180  # 3 min for the agent to run
        )

        print("\n" + "=" * 60)
        print("AGENT OUTPUT:")
        print("=" * 60)
        print(result.stdout)

        if result.stderr:
            print("\nSTDERR:")
            print(result.stderr)

    finally:
        print("\n[Cleanup] Destroying sandbox...")
        sbx.kill()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
