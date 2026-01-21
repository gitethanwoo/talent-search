/**
 * E2B Sandbox Runner module for running agents in ephemeral sandboxes
 * Uses E2B's Sandbox API to execute Claude agents in isolated environments
 */

import { Sandbox } from 'e2b';

/**
 * Runs an agent with the given prompt in an ephemeral E2B sandbox
 * @param prompt - The prompt to pass to the Claude agent
 * @param env - Environment variables to pass to the sandbox (e.g., ANTHROPIC_API_KEY, GH_TOKEN)
 * @returns The stdout output from the agent execution
 */
export async function runInSandbox(
  prompt: string,
  env: Record<string, string>
): Promise<string> {
  const sbx = await Sandbox.create('tenex-sourcing', { envs: env });

  try {
    // Escape single quotes in the prompt for shell safety
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    const result = await sbx.commands.run(
      `echo '${escapedPrompt}' | claude -p --dangerously-skip-permissions`
    );

    return result.stdout;
  } finally {
    await sbx.kill();
  }
}
