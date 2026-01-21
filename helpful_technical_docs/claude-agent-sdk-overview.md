# Agent SDK overview

Build production AI agents with Claude Code as a library

---

Build AI agents that autonomously read files, run commands, search the web, edit code, and more. The Agent SDK gives you the same tools, agent loop, and context management that power Claude Code, programmable in Python and TypeScript.

## Quick Start

```python
# Python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find and fix the bug in auth.py",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"])
    ):
        print(message)  # Claude reads the file, finds the bug, edits it

asyncio.run(main())
```

```typescript
// TypeScript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  console.log(message);  // Claude reads the file, finds the bug, edits it
}
```

## Built-in Tools

| Tool | What it does |
|------|--------------|
| **Read** | Read any file in the working directory |
| **Write** | Create new files |
| **Edit** | Make precise edits to existing files |
| **Bash** | Run terminal commands, scripts, git operations |
| **Glob** | Find files by pattern (`**/*.ts`, `src/**/*.py`) |
| **Grep** | Search file contents with regex |
| **WebSearch** | Search the web for current information |
| **WebFetch** | Fetch and parse web page content |
| **AskUserQuestion** | Ask the user clarifying questions with multiple choice options |

## Example: Find TODOs

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find all TODO comments and create a summary",
  options: { allowedTools: ["Read", "Glob", "Grep"] }
})) {
  if ("result" in message) console.log(message.result);
}
```

## Hooks

Run custom code at key points in the agent lifecycle. Available hooks: `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`.

```typescript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { appendFileSync } from "fs";

const logFileChange: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "unknown";
  appendFileSync("./audit.log", `${new Date().toISOString()}: modified ${filePath}\n`);
  return {};
};

for await (const message of query({
  prompt: "Refactor utils.py to improve readability",
  options: {
    permissionMode: "acceptEdits",
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [logFileChange] }]
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

## Subagents

Spawn specialized agents to handle focused subtasks. Include `Task` in `allowedTools` since subagents are invoked via the Task tool:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Use the code-reviewer agent to review this codebase",
  options: {
    allowedTools: ["Read", "Glob", "Grep", "Task"],
    agents: {
      "code-reviewer": {
        description: "Expert code reviewer for quality and security reviews.",
        prompt: "Analyze code quality and suggest improvements.",
        tools: ["Read", "Glob", "Grep"]
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

Messages from within a subagent's context include a `parent_tool_use_id` field.

## MCP (Model Context Protocol)

Connect to external systems via MCP: databases, browsers, APIs.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Open example.com and describe what you see",
  options: {
    mcpServers: {
      playwright: { command: "npx", args: ["@playwright/mcp@latest"] }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

## Permissions

Control exactly which tools your agent can use.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Review this code for best practices",
  options: {
    allowedTools: ["Read", "Glob", "Grep"],
    permissionMode: "bypassPermissions"
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

## Sessions

Maintain context across multiple exchanges. Resume sessions later, or fork them.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

let sessionId: string | undefined;

// First query: capture the session ID
for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Resume with full context from the first query
for await (const message of query({
  prompt: "Now find all places that call it",  // "it" = auth module
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

## Installation

### 1. Install Claude Code

```bash
# macOS/Linux/WSL
curl -fsSL https://claude.ai/install.sh | bash

# Homebrew
brew install --cask claude-code

# WinGet
winget install Anthropic.ClaudeCode
```

### 2. Install the SDK

```bash
# TypeScript
npm install @anthropic-ai/claude-agent-sdk

# Python
pip install claude-agent-sdk
```

### 3. Set your API key

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Also supports:
- **Amazon Bedrock**: set `CLAUDE_CODE_USE_BEDROCK=1`
- **Google Vertex AI**: set `CLAUDE_CODE_USE_VERTEX=1`
- **Microsoft Foundry**: set `CLAUDE_CODE_USE_FOUNDRY=1`

## Agent SDK vs Client SDK

```typescript
// Client SDK: You implement the tool loop
let response = await client.messages.create({...});
while (response.stop_reason === "tool_use") {
  const result = yourToolExecutor(response.tool_use);
  response = await client.messages.create({ tool_result: result, ... });
}

// Agent SDK: Claude handles tools autonomously
for await (const message of query({ prompt: "Fix the bug in auth.py" })) {
  console.log(message);
}
```

## Agent SDK vs Claude Code CLI

| Use case | Best choice |
|----------|-------------|
| Interactive development | CLI |
| CI/CD pipelines | SDK |
| Custom applications | SDK |
| One-off tasks | CLI |
| Production automation | SDK |

## Links

- TypeScript SDK: https://github.com/anthropics/claude-agent-sdk-typescript
- Python SDK: https://github.com/anthropics/claude-agent-sdk-python
- Example agents: https://github.com/anthropics/claude-agent-sdk-demos
