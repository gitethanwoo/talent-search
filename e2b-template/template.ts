import { Template } from 'e2b'

/**
 * E2B template with Claude Code and gh CLI pre-installed.
 * Used for fast sandbox spin-up when running sourcing agents.
 */
export const template = Template()
  .fromNodeImage('24')
  .aptInstall(['curl', 'git', 'ripgrep', 'gh'])
  .npmInstall('@anthropic-ai/claude-code@latest', { g: true })
  .npmInstall('@anthropic-ai/claude-agent-sdk')
