# Tenex

Automated lead sourcing agent that discovers developers engaging with AI/agent repositories across GitHub, Hacker News, and Twitter.

## How It Works

1. **Researchers** - Three parallel agents scan for leads:
   - GitHub: Contributors, PR authors, issue filers via `gh` CLI
   - Hacker News: Discussion participants via Algolia API
   - Twitter: Tweet authors via Nitter (no auth required)

2. **E2B Sandboxes** - Each researcher runs in an isolated [E2B](https://e2b.dev) sandbox with Claude Code

3. **Validation** - Leads pass through an observer (Claude Haiku) for schema validation and filtering

4. **Persistence** - Valid leads are stored in Convex with scores and confidence tiers

5. **Scheduling** - Convex cron triggers daily runs at 6am UTC

## Prerequisites

- Node.js 20+
- pnpm
- GitHub CLI (`gh`) authenticated
- API keys for: Anthropic, E2B, Convex

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
E2B_API_KEY=e2b_...
GH_TOKEN=ghp_...
CONVEX_URL=https://....convex.cloud
```

### 3. Build E2B template

This creates a sandbox image with Claude Code and gh CLI pre-installed:

```bash
npx tsx e2b-template/build.ts
```

### 4. Set up Convex

```bash
npx convex dev
```

This will:
- Create your Convex project (if new)
- Deploy schema and functions
- Start the cron job

Add environment variables in the [Convex dashboard](https://dashboard.convex.dev):
- `ANTHROPIC_API_KEY`
- `E2B_API_KEY`
- `GH_TOKEN`

## Usage

### Run locally

```bash
# Scan all seed repos
pnpm source

# Scan a single repo
pnpm source --repo vercel-labs/agent-browser
```

### Manual trigger via Convex

```typescript
import { api } from "./convex/_generated/api";

// From your app
await convex.action(api.sourcing.triggerSourcing, {});
```

### Automatic (cron)

Once deployed, sourcing runs daily at 6am UTC. Monitor runs in the Convex dashboard under Functions → crons.

## Project Structure

```
src/
├── cli.ts                 # CLI entry point
├── orchestrator.ts        # Coordinates researchers, merges leads
├── observer.ts            # Validates leads via Claude Haiku
├── sandbox-runner.ts      # E2B sandbox wrapper
└── researchers/
    ├── github-researcher.ts
    ├── hn-researcher.ts
    └── twitter-researcher.ts

convex/
├── schema.ts              # Database schema
├── prospects.ts           # Lead CRUD operations
├── sourcingRuns.ts        # Run logging
├── sourcing.ts            # E2B action for cron
└── crons.ts               # Daily schedule

e2b-template/
├── template.ts            # Sandbox image definition
└── build.ts               # Build script
```

## Configuration

### Seed Repos

Edit `src/config/seed-repos.ts` to add repositories to scan:

```typescript
export const seedRepos: SeedRepo[] = [
  { url: "https://github.com/vercel-labs/agent-browser", category: "agents" },
  { url: "https://github.com/anthropics/claude-code", category: "sdks" },
];
```

### Scoring

Each researcher scores leads based on engagement signals:
- **GitHub**: Contributions, profile completeness, email availability
- **HN**: Story points, URL presence
- **Twitter**: Likes, retweets

Tiers: `high` (70+), `medium` (40-69), `low` (<40)

## Development

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test

# Convex dev mode (hot reload)
npx convex dev
```

## License

MIT
