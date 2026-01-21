import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runInSandbox } from './sandbox-runner';

// Mock the e2b SDK
vi.mock('e2b', () => {
  return {
    Sandbox: {
      create: vi.fn(),
    },
  };
});

import { Sandbox } from 'e2b';

describe('runInSandbox', () => {
  let mockKill: ReturnType<typeof vi.fn>;
  let mockRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKill = vi.fn().mockResolvedValue(undefined);
    mockRun = vi.fn();

    (Sandbox.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      commands: {
        run: mockRun,
      },
      kill: mockKill,
    });
  });

  it('creates sandbox with correct template and env vars', async () => {
    mockRun.mockResolvedValue({ stdout: 'output' });

    const env = { ANTHROPIC_API_KEY: 'test-key', GH_TOKEN: 'gh-token' };
    await runInSandbox('test prompt', env);

    expect(Sandbox.create).toHaveBeenCalledWith('tenex-sourcing', { envs: env });
  });

  it('runs the correct command with prompt', async () => {
    mockRun.mockResolvedValue({ stdout: 'agent output' });

    await runInSandbox('analyze this repo', {});

    expect(mockRun).toHaveBeenCalledWith(
      "echo 'analyze this repo' | claude -p --dangerously-skip-permissions"
    );
  });

  it('returns stdout from the command', async () => {
    const expectedOutput = 'Agent completed successfully with results';
    mockRun.mockResolvedValue({ stdout: expectedOutput });

    const result = await runInSandbox('test prompt', {});

    expect(result).toBe(expectedOutput);
  });

  it('escapes single quotes in prompt', async () => {
    mockRun.mockResolvedValue({ stdout: 'output' });

    await runInSandbox("it's a test with 'quotes'", {});

    expect(mockRun).toHaveBeenCalledWith(
      "echo 'it'\\''s a test with '\\''quotes'\\''' | claude -p --dangerously-skip-permissions"
    );
  });

  it('calls kill in finally block on success', async () => {
    mockRun.mockResolvedValue({ stdout: 'output' });

    await runInSandbox('test', {});

    expect(mockKill).toHaveBeenCalledTimes(1);
  });

  it('calls kill in finally block on error', async () => {
    mockRun.mockRejectedValue(new Error('Command failed'));

    await expect(runInSandbox('test', {})).rejects.toThrow('Command failed');
    expect(mockKill).toHaveBeenCalledTimes(1);
  });

  it('handles empty stdout', async () => {
    mockRun.mockResolvedValue({ stdout: '' });

    const result = await runInSandbox('test', {});

    expect(result).toBe('');
  });

  it('handles multiline prompts', async () => {
    mockRun.mockResolvedValue({ stdout: 'output' });
    const multilinePrompt = 'line1\nline2\nline3';

    await runInSandbox(multilinePrompt, {});

    expect(mockRun).toHaveBeenCalledWith(
      "echo 'line1\nline2\nline3' | claude -p --dangerously-skip-permissions"
    );
  });
});
