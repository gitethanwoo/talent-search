import { describe, it, expect, vi, beforeEach } from 'vitest';
import { researchRepo } from './github-researcher.js';

// Mock the sandbox runner
vi.mock('../sandbox-runner.js', () => ({
  runInSandbox: vi.fn(),
}));

// Mock fs for reading the prompt file
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Mock prompt content'),
}));

import { runInSandbox } from '../sandbox-runner.js';

describe('github-researcher', () => {
  const mockRunInSandbox = runInSandbox as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('researchRepo', () => {
    it('returns leads for valid contributor data', async () => {
      const contributorData = {
        contributors: [
          {
            username: 'testuser',
            name: 'Test User',
            email: 'test@example.com',
            company: 'Test Corp',
            location: 'San Francisco',
            bio: 'A developer',
            twitter: 'testuser',
            contributions: 42,
          },
          {
            username: 'anotheruser',
            name: 'Another User',
            contributions: 5,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(contributorData));

      const leads = await researchRepo('vercel-labs/agent-browser');

      expect(leads).toHaveLength(2);
      expect(leads[0]).toEqual({
        githubUsername: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        emailSource: 'github-profile',
        company: 'Test Corp',
        location: 'San Francisco',
        bio: 'A developer',
        twitterHandle: 'testuser',
        discoveredFrom: ['github-contributors:vercel-labs/agent-browser'],
        confidenceTier: 'high',
        score: expect.any(Number),
      });
      expect(leads[1]).toEqual({
        githubUsername: 'anotheruser',
        name: 'Another User',
        discoveredFrom: ['github-contributors:vercel-labs/agent-browser'],
        confidenceTier: 'low',
        score: expect.any(Number),
      });
    });

    it('calls runInSandbox with prompt containing repo', async () => {
      mockRunInSandbox.mockResolvedValue('{"contributors": []}');

      await researchRepo('test/repo');

      expect(mockRunInSandbox).toHaveBeenCalledWith(
        expect.stringContaining('test/repo'),
        expect.any(Object)
      );
    });

    it('returns empty array for invalid JSON output', async () => {
      mockRunInSandbox.mockResolvedValue('not valid json');

      const leads = await researchRepo('test/repo');

      expect(leads).toEqual([]);
    });

    it('returns empty array when no contributors key', async () => {
      mockRunInSandbox.mockResolvedValue('{"data": []}');

      const leads = await researchRepo('test/repo');

      expect(leads).toEqual([]);
    });

    it('returns empty array when contributors is not an array', async () => {
      mockRunInSandbox.mockResolvedValue('{"contributors": "not an array"}');

      const leads = await researchRepo('test/repo');

      expect(leads).toEqual([]);
    });

    it('extracts JSON from output with surrounding text', async () => {
      const contributorData = {
        contributors: [
          {
            username: 'user1',
            name: 'User One',
            contributions: 10,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(
        `Here are the contributors:\n\n${JSON.stringify(contributorData)}\n\nDone!`
      );

      const leads = await researchRepo('test/repo');

      expect(leads).toHaveLength(1);
      expect(leads[0].githubUsername).toBe('user1');
    });

    it('handles contributor with email from commits', async () => {
      const contributorData = {
        contributors: [
          {
            username: 'committer',
            name: 'Committer User',
            email: 'commit@example.com',
            emailSource: 'commit-history',
            contributions: 20,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(contributorData));

      const leads = await researchRepo('test/repo');

      expect(leads[0].email).toBe('commit@example.com');
      expect(leads[0].emailSource).toBe('commit-history');
    });
  });

  describe('confidence tier determination', () => {
    it('assigns high confidence for complete profiles with email', async () => {
      const contributorData = {
        contributors: [
          {
            username: 'complete',
            name: 'Complete User',
            email: 'complete@example.com',
            company: 'Big Corp',
            contributions: 50,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(contributorData));

      const leads = await researchRepo('test/repo');

      expect(leads[0].confidenceTier).toBe('high');
    });

    it('assigns medium confidence for partial profiles', async () => {
      const contributorData = {
        contributors: [
          {
            username: 'partial',
            name: 'Partial User',
            contributions: 15,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(contributorData));

      const leads = await researchRepo('test/repo');

      expect(leads[0].confidenceTier).toBe('medium');
    });

    it('assigns low confidence for minimal profiles', async () => {
      const contributorData = {
        contributors: [
          {
            username: 'minimal',
            contributions: 1,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(contributorData));

      const leads = await researchRepo('test/repo');

      expect(leads[0].confidenceTier).toBe('low');
    });
  });

  describe('score calculation', () => {
    it('calculates score based on contributions and profile completeness', async () => {
      const contributorData = {
        contributors: [
          {
            username: 'scored',
            name: 'Scored User',
            email: 'scored@example.com',
            company: 'Score Corp',
            location: 'NYC',
            bio: 'Bio here',
            twitter: 'scored',
            contributions: 25,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(contributorData));

      const leads = await researchRepo('test/repo');

      // 25 contributions * 2 = 50 (capped at 40) + 15 (name) + 20 (email) + 10 (company) + 5 (location) + 5 (bio) + 5 (twitter) = 100
      expect(leads[0].score).toBe(100);
    });

    it('caps score at 100', async () => {
      const contributorData = {
        contributors: [
          {
            username: 'superuser',
            name: 'Super User',
            email: 'super@example.com',
            company: 'Super Corp',
            location: 'Everywhere',
            bio: 'The best',
            twitter: 'superuser',
            contributions: 1000,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(contributorData));

      const leads = await researchRepo('test/repo');

      expect(leads[0].score).toBeLessThanOrEqual(100);
    });

    it('gives low score for minimal profile', async () => {
      const contributorData = {
        contributors: [
          {
            username: 'lowscore',
            contributions: 1,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(contributorData));

      const leads = await researchRepo('test/repo');

      // 1 contribution * 2 = 2
      expect(leads[0].score).toBe(2);
    });
  });
});
