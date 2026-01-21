# E2B TypeScript SDK Reference

Source: https://e2b.dev/docs

## Installation

```bash
npm i @e2b/code-interpreter dotenv
```

Set API key:
```bash
export E2B_API_KEY=e2b_***
```

## Creating Sandboxes

**IMPORTANT: Use `Sandbox.create()` static method, not constructor.**

```typescript
import { Sandbox } from '@e2b/code-interpreter'

// Basic creation (5 min default timeout)
const sandbox = await Sandbox.create()

// With custom timeout
const sandbox = await Sandbox.create({
  timeoutMs: 300_000,  // 5 minutes in ms
})

// With environment variables
const sandbox = await Sandbox.create({
  timeoutMs: 300_000,
  envs: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GH_TOKEN: process.env.GH_TOKEN,
  },
})
```

### Timeout Limits
- **Pro Tier**: 24 hours max
- **Base Tier**: 1 hour max

### Modify Timeout at Runtime
```typescript
await sandbox.setTimeout(30_000)  // Extend to 30 seconds from now
```

### Get Sandbox Info
```typescript
const info = await sandbox.getInfo()
// Returns: sandboxId, templateId, name, metadata, startedAt, endAt
```

## Running Commands

```typescript
const result = await sandbox.commands.run('ls -l')
console.log(result.stdout)
console.log(result.stderr)
console.log(result.exitCode)
```

### With Timeout
```typescript
const result = await sandbox.commands.run('npm install', {
  timeoutMs: 120_000,  // 2 minutes
})
```

### With Environment Variables (per-command)
```typescript
const result = await sandbox.commands.run('python agent.py', {
  envs: {
    ANTHROPIC_API_KEY: 'sk-ant-...',
  },
})
```

## Running Python Code

```typescript
const execution = await sandbox.runCode('print("hello world")')
console.log(execution.logs)
console.log(execution.text)  // Result of last expression
```

### With Environment Variables (per-execution)
```typescript
const result = await sandbox.runCode('import os; print(os.environ.get("MY_VAR"))', {
  envs: {
    MY_VAR: 'my_value',
  },
})
```

## Environment Variables

### 1. Global (at creation)
```typescript
const sandbox = await Sandbox.create({
  envs: { MY_VAR: 'my_value' },
})
```

### 2. Per-command
```typescript
await sandbox.commands.run('echo $MY_VAR', {
  envs: { MY_VAR: '123' },
})
```

### 3. Per-code-execution
```typescript
await sandbox.runCode('...', {
  envs: { MY_VAR: 'value' },
})
```

### Default E2B Variables
These are automatically set:
- `E2B_SANDBOX=true`
- `E2B_SANDBOX_ID` - unique sandbox ID
- `E2B_TEAM_ID` - team that created it
- `E2B_TEMPLATE_ID` - template used

## Installing Packages at Runtime

**Python (pip):**
```typescript
await sandbox.commands.run('pip install cowsay')
```

**Node.js (npm):**
```typescript
await sandbox.commands.run('npm install cowsay')
```

**System packages (apt):**
```typescript
await sandbox.commands.run('apt-get update && apt-get install -y curl git gh')
```

Note: Runtime packages only exist in that sandbox instance.

## File Operations

### Write a file
```typescript
await sandbox.files.write('/home/user/script.py', scriptContent)
```

### List files
```typescript
const files = await sandbox.files.list('/')
console.log(files)
```

### Read a file
```typescript
const content = await sandbox.files.read('/home/user/output.json')
```

## Cleanup

**Always call `kill()` in a finally block:**

```typescript
const sandbox = await Sandbox.create({ timeoutMs: 300_000 })

try {
  // ... do work
  const result = await sandbox.commands.run('python script.py')
  console.log(result.stdout)
} finally {
  await sandbox.kill()
}
```

## Complete Example

```typescript
import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

async function main() {
  const sandbox = await Sandbox.create({
    timeoutMs: 300_000,
    envs: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
    },
  })

  try {
    // Install Claude Code
    await sandbox.commands.run(
      'curl -fsSL https://claude.ai/install.sh | bash',
      { timeoutMs: 120_000 }
    )

    // Install SDK
    await sandbox.commands.run('npm install @anthropic-ai/claude-agent-sdk')

    // Write agent script
    await sandbox.files.write('/home/user/agent.ts', agentScript)

    // Run agent
    const result = await sandbox.commands.run('npx tsx /home/user/agent.ts', {
      timeoutMs: 180_000,
    })

    console.log('Output:', result.stdout)
    if (result.stderr) console.error('Errors:', result.stderr)

  } finally {
    await sandbox.kill()
  }
}

main()
```

## Custom Templates (Pre-installed packages)

For production, create templates with dependencies pre-installed. **This is critical for performance** - don't install Claude Code on every sandbox spin-up.

### Template Definition (template.ts)

```typescript
import { Template } from 'e2b'

export const template = Template()
  .fromNodeImage('24')
  .aptInstall(['curl', 'git', 'ripgrep', 'gh'])  // gh CLI for GitHub
  .npmInstall('@anthropic-ai/claude-code@latest', { g: true })
  .npmInstall('@anthropic-ai/claude-agent-sdk')
```

### Build Script (build.ts)

```typescript
import 'dotenv/config'
import { Template, defaultBuildLogger } from 'e2b'
import { template } from './template'

async function main() {
  await Template.build(template, {
    alias: 'tenex-sourcing',  // Use this alias to create sandboxes
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: defaultBuildLogger(),
  })
}

main().catch(console.error)
```

Build once:
```bash
npx tsx build.ts
```

### Use the Template

```typescript
import { Sandbox } from 'e2b'

// Instant spin-up - Claude Code already installed!
const sbx = await Sandbox.create('tenex-sourcing', {
  envs: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GH_TOKEN: process.env.GH_TOKEN,
  },
})

// Run agent via CLI pipe
const result = await sbx.commands.run(
  `echo 'Find contributors to vercel-labs/agent-browser' | claude -p --dangerously-skip-permissions`,
  { timeoutMs: 180_000 }
)

console.log(result.stdout)
await sbx.kill()
```

### Alternative: Use Claude Agent SDK in Sandbox

```typescript
// Write agent script to sandbox
await sbx.files.write('/home/user/agent.ts', `
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find contributors to vercel-labs/agent-browser using gh CLI",
  options: {
    allowedTools: ["Bash", "WebFetch"],
    permissionMode: "bypassPermissions"
  }
})) {
  if ("result" in message) console.log(message.result);
}
`)

// Run it
const result = await sbx.commands.run('npx tsx /home/user/agent.ts', {
  timeoutMs: 180_000,
})
```
