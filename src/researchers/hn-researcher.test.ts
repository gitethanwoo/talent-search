import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchHN, searchHNAsLeads } from './hn-researcher.js';

// Mock the sandbox runner
vi.mock('../sandbox-runner.js', () => ({
  runInSandbox: vi.fn(),
}));

// Mock fs for reading the prompt file
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Mock prompt content'),
}));

import { runInSandbox } from '../sandbox-runner.js';

describe('hn-researcher', () => {
  const mockRunInSandbox = runInSandbox as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchHN', () => {
    it('returns HNLead array for valid search results', async () => {
      const hnData = {
        results: [
          {
            title: 'Show HN: Agent Browser - AI-powered browser automation',
            author: 'devuser1',
            points: 256,
            url: 'https://github.com/vercel-labs/agent-browser',
          },
          {
            title: 'Agent Browser: A new way to automate the web',
            author: 'techposter',
            points: 142,
            url: 'https://blog.example.com/agent-browser',
          },
          {
            title: 'Ask HN: Thoughts on agent-browser for testing?',
            author: 'qaengineer',
            points: 45,
            url: null,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHN('agent-browser');

      expect(leads).toHaveLength(3);
      expect(leads[0]).toEqual({
        hnUsername: 'devuser1',
        storyTitle: 'Show HN: Agent Browser - AI-powered browser automation',
        points: 256,
        url: 'https://github.com/vercel-labs/agent-browser',
      });
      expect(leads[1]).toEqual({
        hnUsername: 'techposter',
        storyTitle: 'Agent Browser: A new way to automate the web',
        points: 142,
        url: 'https://blog.example.com/agent-browser',
      });
      expect(leads[2]).toEqual({
        hnUsername: 'qaengineer',
        storyTitle: 'Ask HN: Thoughts on agent-browser for testing?',
        points: 45,
        url: null,
      });
    });

    it('calls runInSandbox with prompt containing search query', async () => {
      mockRunInSandbox.mockResolvedValue('{"results": []}');

      await searchHN('test-query');

      expect(mockRunInSandbox).toHaveBeenCalledWith(
        expect.stringContaining('test-query'),
        expect.any(Object)
      );
    });

    it('returns empty array for invalid JSON output', async () => {
      mockRunInSandbox.mockResolvedValue('not valid json');

      const leads = await searchHN('test-query');

      expect(leads).toEqual([]);
    });

    it('returns empty array when no results key', async () => {
      mockRunInSandbox.mockResolvedValue('{"data": []}');

      const leads = await searchHN('test-query');

      expect(leads).toEqual([]);
    });

    it('returns empty array when results is not an array', async () => {
      mockRunInSandbox.mockResolvedValue('{"results": "not an array"}');

      const leads = await searchHN('test-query');

      expect(leads).toEqual([]);
    });

    it('extracts JSON from output with surrounding text', async () => {
      const hnData = {
        results: [
          {
            title: 'Test Story',
            author: 'testuser',
            points: 100,
            url: 'https://example.com',
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(
        `Here are the HN results:\n\n${JSON.stringify(hnData)}\n\nSearch complete!`
      );

      const leads = await searchHN('test-query');

      expect(leads).toHaveLength(1);
      expect(leads[0].hnUsername).toBe('testuser');
    });

    it('filters out results with empty author', async () => {
      const hnData = {
        results: [
          {
            title: 'Valid Story',
            author: 'validuser',
            points: 50,
            url: 'https://example.com',
          },
          {
            title: 'Invalid Story',
            author: '',
            points: 100,
            url: 'https://example.com',
          },
          {
            title: 'Another Invalid',
            author: '   ',
            points: 75,
            url: null,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHN('test-query');

      expect(leads).toHaveLength(1);
      expect(leads[0].hnUsername).toBe('validuser');
    });

    it('handles missing points gracefully', async () => {
      const hnData = {
        results: [
          {
            title: 'No Points Story',
            author: 'testuser',
            url: 'https://example.com',
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHN('test-query');

      expect(leads).toHaveLength(1);
      expect(leads[0].points).toBe(0);
    });
  });

  describe('searchHNAsLeads', () => {
    it('converts HNLead to standard Lead format', async () => {
      const hnData = {
        results: [
          {
            title: 'Show HN: Agent Browser',
            author: 'developer123',
            points: 150,
            url: 'https://github.com/test/repo',
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHNAsLeads('agent-browser');

      expect(leads).toHaveLength(1);
      expect(leads[0]).toEqual({
        githubUsername: 'developer123',
        discoveredFrom: ['hacker-news:agent-browser'],
        confidenceTier: 'high',
        score: expect.any(Number),
      });
    });
  });

  describe('confidence tier determination', () => {
    it('assigns high confidence for high points with URL', async () => {
      const hnData = {
        results: [
          {
            title: 'Popular Story',
            author: 'popularuser',
            points: 150,
            url: 'https://example.com',
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHNAsLeads('test');

      expect(leads[0].confidenceTier).toBe('high');
    });

    it('assigns medium confidence for medium points', async () => {
      const hnData = {
        results: [
          {
            title: 'Medium Story',
            author: 'mediumuser',
            points: 75,
            url: null,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHNAsLeads('test');

      expect(leads[0].confidenceTier).toBe('medium');
    });

    it('assigns medium confidence for low points with URL', async () => {
      const hnData = {
        results: [
          {
            title: 'Story with Link',
            author: 'linkuser',
            points: 10,
            url: 'https://example.com',
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHNAsLeads('test');

      expect(leads[0].confidenceTier).toBe('medium');
    });

    it('assigns low confidence for low points without URL', async () => {
      const hnData = {
        results: [
          {
            title: 'Low Engagement Story',
            author: 'lowuser',
            points: 5,
            url: null,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHNAsLeads('test');

      expect(leads[0].confidenceTier).toBe('low');
    });
  });

  describe('score calculation', () => {
    it('calculates score based on points and URL presence', async () => {
      const hnData = {
        results: [
          {
            title: 'Test Story',
            author: 'testuser',
            points: 30,
            url: 'https://example.com',
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHNAsLeads('test');

      // 30 points + 20 (URL) + 10 (title) = 60
      expect(leads[0].score).toBe(60);
    });

    it('caps points contribution at 50', async () => {
      const hnData = {
        results: [
          {
            title: 'Very Popular Story',
            author: 'popularuser',
            points: 500,
            url: 'https://example.com',
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHNAsLeads('test');

      // 50 (capped) + 20 (URL) + 10 (title) = 80
      expect(leads[0].score).toBe(80);
    });

    it('caps total score at 100', async () => {
      const hnData = {
        results: [
          {
            title: 'Max Score Story',
            author: 'maxuser',
            points: 1000,
            url: 'https://example.com',
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHNAsLeads('test');

      expect(leads[0].score).toBeLessThanOrEqual(100);
    });

    it('gives low score for minimal engagement', async () => {
      const hnData = {
        results: [
          {
            title: 'Low Score Story',
            author: 'lowuser',
            points: 2,
            url: null,
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHNAsLeads('test');

      // 2 points + 0 (no URL) + 10 (title) = 12
      expect(leads[0].score).toBe(12);
    });
  });

  describe('integration: search for agent-browser', () => {
    it('returns 3+ results for agent-browser search (mock)', async () => {
      // This test verifies the expected output format for the acceptance criteria
      const hnData = {
        results: [
          {
            title: 'Show HN: Agent Browser - AI browser automation',
            author: 'dev1',
            points: 200,
            url: 'https://github.com/vercel-labs/agent-browser',
          },
          {
            title: 'Agent Browser: Next generation web testing',
            author: 'dev2',
            points: 150,
            url: 'https://blog.example.com/agent-browser',
          },
          {
            title: 'Ask HN: Using agent-browser for E2E tests',
            author: 'dev3',
            points: 75,
            url: null,
          },
          {
            title: 'Agent Browser vs Puppeteer comparison',
            author: 'dev4',
            points: 90,
            url: 'https://comparison.example.com',
          },
        ],
      };

      mockRunInSandbox.mockResolvedValue(JSON.stringify(hnData));

      const leads = await searchHN('agent-browser');

      expect(leads.length).toBeGreaterThanOrEqual(3);

      // Verify each lead has required fields
      for (const lead of leads) {
        expect(lead).toHaveProperty('hnUsername');
        expect(lead).toHaveProperty('storyTitle');
        expect(lead).toHaveProperty('points');
        expect(lead).toHaveProperty('url');
        expect(typeof lead.hnUsername).toBe('string');
        expect(typeof lead.storyTitle).toBe('string');
        expect(typeof lead.points).toBe('number');
      }
    });
  });
});
