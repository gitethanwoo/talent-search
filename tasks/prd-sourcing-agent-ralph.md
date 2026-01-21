[PRD]
# PRD: TeneX AI Sourcing Agent (TypeScript)

## Overview

Build an AI-native sourcing system that discovers high-signal engineering candidates by scanning GitHub repos and social mentions. The system uses ephemeral E2B sandboxes running Claude Agent SDK to gather leads daily, with results persisted to Convex.

**Key insight:** Agents handle complexity (scraping, parsing, edge cases). Deterministic code handles orchestration (spin up, tear down, persist).

**Stack:** TypeScript end-to-end (Claude Agent SDK, E2B, Convex)

## Goals

- Discover 50-100 mid-high confidence prospects per week
- Extract leads from GitHub (contributors, PR authors), HN, Twitter
- Enrich leads with emails, profiles, company info
- Score and persist to Convex for human review
- Run autonomously on daily schedule

## Quality Gates

These commands must pass for every user story:
- `pnpm typecheck` - TypeScript compilation
- `pnpm test` - Vitest tests pass
- `npx convex dev --typecheck` - Convex schema valid
- Agent produces valid JSON output matching expected schema

## User Stories

### US-001: Set up TypeScript project structure
**Description:** As a developer, I want the project scaffolded so I can start building components.

**Acceptance Criteria:**
- [ ] Create `src/` directory for main source code
- [ ] Create `src/researchers/` directory for researcher modules
- [ ] Create `src/prompts/` directory for agent prompts
- [ ] Create `convex/` directory for Convex schema/functions
- [ ] Create `e2b-template/` directory for E2B template definition
- [ ] Create `package.json` with dependencies: @anthropic-ai/claude-agent-sdk, e2b, @e2b/code-interpreter, vitest
- [ ] Create `tsconfig.json` with strict mode enabled
- [ ] Create `.env.example` with: ANTHROPIC_API_KEY, E2B_API_KEY, CONVEX_URL, GH_TOKEN

### US-002: Create E2B template with Claude Code
**Description:** As an orchestrator, I need a pre-built E2B template with Claude Code and gh CLI installed for fast sandbox spin-up.

**Acceptance Criteria:**
- [ ] Create `e2b-template/template.ts` using Template().fromNodeImage('24')
- [ ] Template installs apt packages: curl, git, ripgrep, gh
- [ ] Template installs @anthropic-ai/claude-code globally
- [ ] Template installs @anthropic-ai/claude-agent-sdk
- [ ] Create `e2b-template/build.ts` to build template with alias 'tenex-sourcing'
- [ ] Template builds successfully with `npx tsx e2b-template/build.ts`
- [ ] Sandbox.create('tenex-sourcing') works and has claude command available

### US-003: Create Convex schema
**Description:** As a developer, I need the database schema defined so agents can persist leads.

**Acceptance Criteria:**
- [ ] Create `convex/schema.ts` with tables: seedRepos, prospects, outreachDrafts, sourcingRuns
- [ ] prospects table has fields: githubUsername, name, email, emailSource, twitterHandle, company, location, bio, discoveredFrom (array), confidenceTier, score, status, dateDiscovered
- [ ] prospects table has indexes: by_github, by_tier, by_status
- [ ] seedRepos table has fields: name, url, category, status, dateAdded
- [ ] sourcingRuns table has fields: startedAt, completedAt, prospectsFound, errors
- [ ] Schema passes `npx convex dev --typecheck`

### US-004: Create Convex functions for prospects
**Description:** As an agent, I need CRUD functions to read/write prospects.

**Acceptance Criteria:**
- [ ] Create `convex/prospects.ts` with mutations: createProspect, updateProspect, upsertProspect
- [ ] Create queries: getProspectByGithub, getProspectsByTier, getProspectsByStatus
- [ ] upsertProspect checks for existing githubUsername and updates if found
- [ ] All functions have proper TypeScript types using Convex validators

### US-005: Build GitHub researcher prompt
**Description:** As a lead agent, I need a prompt that tells the GitHub researcher what to do.

**Acceptance Criteria:**
- [ ] Create `src/prompts/github-researcher.txt`
- [ ] Prompt instructs agent to use `gh` CLI commands
- [ ] Prompt specifies output format: JSON with username, name, email, company, contributions
- [ ] Prompt includes example commands: `gh api repos/.../contributors`, `gh api users/...`
- [ ] Prompt tells agent to get email from commit history if not in profile

### US-006: Build GitHub researcher module
**Description:** As a sourcing system, I need to extract contributors from GitHub repos.

**Acceptance Criteria:**
- [ ] Create `src/researchers/github-researcher.ts`
- [ ] Implement `async function researchRepo(repo: string): Promise<Lead[]>` using Claude Agent SDK
- [ ] Agent uses Bash tool with `gh` CLI
- [ ] Returns list of leads with: username, name, email, emailSource, company, location, bio, twitter, contributions
- [ ] Test: Run against `vercel-labs/agent-browser`, expect 5+ leads returned

### US-007: Build HN researcher prompt
**Description:** As a lead agent, I need a prompt for searching Hacker News.

**Acceptance Criteria:**
- [ ] Create `src/prompts/hn-researcher.txt`
- [ ] Prompt instructs agent to use WebFetch with Algolia API
- [ ] Prompt specifies: `https://hn.algolia.com/api/v1/search?query=...&tags=story`
- [ ] Prompt specifies output format: JSON with title, author, points, url
- [ ] Prompt tells agent to search for seed repo names

### US-008: Build HN researcher module
**Description:** As a sourcing system, I need to find people posting about seed repos on HN.

**Acceptance Criteria:**
- [ ] Create `src/researchers/hn-researcher.ts`
- [ ] Implement `async function searchHN(query: string): Promise<HNLead[]>` using Claude Agent SDK
- [ ] Agent uses WebFetch tool
- [ ] Returns list with: hnUsername, storyTitle, points, url
- [ ] Test: Search for "agent-browser", expect 3+ results

### US-009: Build observer/validator
**Description:** As a security measure, I need to validate agent output before persisting.

**Acceptance Criteria:**
- [ ] Create `src/observer.ts`
- [ ] Implement `async function validateLeads(rawOutput: string): Promise<Lead[] | null>`
- [ ] Uses Claude Haiku to validate JSON schema
- [ ] Returns null if output is invalid or suspicious
- [ ] Returns cleaned list of leads if valid
- [ ] Test: Valid JSON passes, malformed JSON returns null

### US-010: Build E2B sandbox runner
**Description:** As an orchestrator, I need to run agents in ephemeral E2B sandboxes.

**Acceptance Criteria:**
- [ ] Create `src/sandbox-runner.ts`
- [ ] Implement `async function runInSandbox(prompt: string, env: Record<string, string>): Promise<string>`
- [ ] Uses `Sandbox.create('tenex-sourcing')` with pre-built template
- [ ] Passes environment variables (ANTHROPIC_API_KEY, GH_TOKEN) to sandbox
- [ ] Runs agent via `echo 'prompt' | claude -p --dangerously-skip-permissions`
- [ ] Returns stdout
- [ ] Calls `sbx.kill()` in finally block
- [ ] Test: Run simple prompt, verify output returned

### US-011: Create seed repos configuration
**Description:** As a user, I need to configure which repos to scan.

**Acceptance Criteria:**
- [ ] Create `src/config/seed-repos.ts` with typed configuration
- [ ] Include: vercel-labs/agent-browser, vercel-labs/agent-skills, vercel-labs/json-render
- [ ] Include: anthropics/claude-code, vercel/ai
- [ ] Each entry has: url, category ('agents' | 'sdks' | 'ai-tools')
- [ ] Export typed array of SeedRepo objects

### US-013: Build Twitter/Nitter researcher prompt
**Description:** As a lead agent, I need a prompt for searching Twitter via Nitter.

**Acceptance Criteria:**
- [ ] Create `src/prompts/twitter-researcher.txt`
- [ ] Prompt instructs agent to use WebFetch with Nitter (no login required)
- [ ] Prompt specifies URL pattern: `https://nitter.poast.org/search?f=tweets&q=...`
- [ ] Prompt specifies output format: JSON with twitterHandle, tweetText, likes, retweets
- [ ] Prompt includes fallback Nitter instances: nitter.poast.org, nitter.privacydev.net

### US-014: Build Twitter/Nitter researcher module
**Description:** As a sourcing system, I need to find people tweeting about seed repos.

**Acceptance Criteria:**
- [ ] Create `src/researchers/twitter-researcher.ts`
- [ ] Implement `async function searchTwitter(query: string): Promise<TwitterLead[]>` using Claude Agent SDK
- [ ] Agent uses WebFetch tool with Nitter frontend
- [ ] Parses HTML response to extract: twitterHandle, tweetText, likes, retweets
- [ ] Returns list of Twitter leads
- [ ] Test: Search for "agent-browser vercel", expect results with @handles

### US-015: Build lead agent orchestrator
**Description:** As a daily job, I need to coordinate all researchers and persist results.

**Acceptance Criteria:**
- [ ] Create `src/orchestrator.ts`
- [ ] Implement `async function runDailySourcing(seedRepos: SeedRepo[]): Promise<SourcingResult>`
- [ ] Spawns GitHub researcher for each seed repo (can be parallel)
- [ ] Spawns HN researcher for each seed repo
- [ ] Spawns Twitter researcher for each seed repo
- [ ] Collects all results
- [ ] Passes through observer/validator
- [ ] Persists valid leads to Convex via HTTP API
- [ ] Logs run to sourcingRuns table
- [ ] Test: Mock researchers, verify Convex calls made

### US-016: Create CLI entry point
**Description:** As a user, I need a CLI to run the sourcing agent manually or via cron.

**Acceptance Criteria:**
- [ ] Create `src/cli.ts` as main entry point
- [ ] Supports `pnpm run source` to run daily sourcing
- [ ] Supports `pnpm run source --repo <repo>` to scan single repo
- [ ] Loads environment variables from .env
- [ ] Prints summary of leads found at completion
- [ ] Add scripts to package.json

## Functional Requirements

- FR-1: System must run in ephemeral E2B sandbox with no persistent state
- FR-2: System must use read-only GitHub token (no write permissions)
- FR-3: All agent output must pass through observer validation before persistence
- FR-4: System must dedupe leads by githubUsername
- FR-5: System must complete daily run in under 30 minutes
- FR-6: System must handle API rate limits gracefully (retry with backoff)

## Non-Goals (Out of Scope)

- Reddit scraping (aggressive bot detection, even with browser automation)
- LinkedIn integration
- Automated email sending
- Dashboard UI
- Multi-agent parallel execution within sandbox (single agent per sandbox for now)

## Technical Considerations

- E2B sandbox uses `Sandbox.create('tenex-sourcing')` with pre-built template
- E2B Template API: `Template().fromNodeImage('24').aptInstall([...]).npmInstall([...])`
- Claude Agent SDK: `for await (const message of query({...})) { ... }`
- GH_TOKEN must be fine-grained PAT with read-only public_repo scope
- Convex functions are called via HTTP API from sandbox

## Success Metrics

- 50-100 mid-high confidence prospects per week
- <5% duplicate rate across runs
- Agent completes in <30 minutes per daily run
- Zero security incidents from prompt injection

## Open Questions

- Should we batch Convex writes or write one at a time?
- How to handle Nitter instance rotation if one goes down?
[/PRD]
