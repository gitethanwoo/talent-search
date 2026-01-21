import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchTwitter, searchTwitterAsLeads } from './twitter-researcher.js';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock fs for reading the prompt file
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Mock prompt content'),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';

describe('twitter-researcher', () => {
  const mockQuery = query as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchTwitter', () => {
    it('returns TwitterLead array for valid search results', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'devuser1',
            tweetText: 'Just tried agent-browser from Vercel, amazing tool! 🚀',
            likes: 156,
            retweets: 42,
          },
          {
            twitterHandle: 'techposter',
            tweetText: 'Agent browser is a game changer for web automation',
            likes: 89,
            retweets: 23,
          },
          {
            twitterHandle: 'webdev',
            tweetText: 'Testing with agent-browser vercel',
            likes: 12,
            retweets: 3,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitter('agent-browser vercel');

      expect(leads).toHaveLength(3);
      expect(leads[0]).toEqual({
        twitterHandle: 'devuser1',
        tweetText: 'Just tried agent-browser from Vercel, amazing tool! 🚀',
        likes: 156,
        retweets: 42,
      });
      expect(leads[1]).toEqual({
        twitterHandle: 'techposter',
        tweetText: 'Agent browser is a game changer for web automation',
        likes: 89,
        retweets: 23,
      });
      expect(leads[2]).toEqual({
        twitterHandle: 'webdev',
        tweetText: 'Testing with agent-browser vercel',
        likes: 12,
        retweets: 3,
      });
    });

    it('calls query with WebFetch tool and correct options', async () => {
      mockQuery.mockImplementation(async function* () {
        yield { result: '{"results": []}' };
      });

      await searchTwitter('test-query');

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: expect.stringContaining('test-query'),
        options: {
          allowedTools: ['WebFetch'],
          permissionMode: 'bypassPermissions',
        },
      });
    });

    it('returns empty array for invalid JSON output', async () => {
      mockQuery.mockImplementation(async function* () {
        yield { result: 'not valid json' };
      });

      const leads = await searchTwitter('test-query');

      expect(leads).toEqual([]);
    });

    it('returns empty array when no results key', async () => {
      mockQuery.mockImplementation(async function* () {
        yield { result: '{"data": []}' };
      });

      const leads = await searchTwitter('test-query');

      expect(leads).toEqual([]);
    });

    it('returns empty array when results is not an array', async () => {
      mockQuery.mockImplementation(async function* () {
        yield { result: '{"results": "not an array"}' };
      });

      const leads = await searchTwitter('test-query');

      expect(leads).toEqual([]);
    });

    it('extracts JSON from output with surrounding text', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'testuser',
            tweetText: 'Test tweet content',
            likes: 50,
            retweets: 10,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield {
          result: `Here are the Twitter results:\n\n${JSON.stringify(twitterData)}\n\nSearch complete!`,
        };
      });

      const leads = await searchTwitter('test-query');

      expect(leads).toHaveLength(1);
      expect(leads[0].twitterHandle).toBe('testuser');
    });

    it('filters out results with empty twitterHandle', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'validuser',
            tweetText: 'Valid tweet',
            likes: 50,
            retweets: 10,
          },
          {
            twitterHandle: '',
            tweetText: 'Invalid tweet',
            likes: 100,
            retweets: 50,
          },
          {
            twitterHandle: '   ',
            tweetText: 'Another invalid',
            likes: 75,
            retweets: 25,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitter('test-query');

      expect(leads).toHaveLength(1);
      expect(leads[0].twitterHandle).toBe('validuser');
    });

    it('handles missing engagement metrics gracefully', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'testuser',
            tweetText: 'Tweet without metrics',
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitter('test-query');

      expect(leads).toHaveLength(1);
      expect(leads[0].likes).toBe(0);
      expect(leads[0].retweets).toBe(0);
    });

    it('strips @ prefix from twitter handles', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: '@userWithAt',
            tweetText: 'Tweet content',
            likes: 10,
            retweets: 2,
          },
          {
            twitterHandle: 'userWithoutAt',
            tweetText: 'Another tweet',
            likes: 15,
            retweets: 3,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitter('test-query');

      expect(leads).toHaveLength(2);
      expect(leads[0].twitterHandle).toBe('userWithAt');
      expect(leads[1].twitterHandle).toBe('userWithoutAt');
    });
  });

  describe('searchTwitterAsLeads', () => {
    it('converts TwitterLead to standard Lead format', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'developer123',
            tweetText: 'Loving agent-browser for testing!',
            likes: 150,
            retweets: 40,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('agent-browser');

      expect(leads).toHaveLength(1);
      expect(leads[0]).toEqual({
        githubUsername: 'developer123',
        twitterHandle: 'developer123',
        discoveredFrom: ['twitter:agent-browser'],
        confidenceTier: 'high',
        score: expect.any(Number),
      });
    });
  });

  describe('confidence tier determination', () => {
    it('assigns high confidence for high total engagement (>= 100)', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'popularuser',
            tweetText: 'Very popular tweet',
            likes: 80,
            retweets: 30,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('test');

      expect(leads[0].confidenceTier).toBe('high');
    });

    it('assigns medium confidence for medium engagement (>= 20 total)', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'mediumuser',
            tweetText: 'Medium engagement tweet',
            likes: 15,
            retweets: 8,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('test');

      expect(leads[0].confidenceTier).toBe('medium');
    });

    it('assigns medium confidence for >= 10 likes', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'likeduser',
            tweetText: 'Tweet with likes',
            likes: 12,
            retweets: 0,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('test');

      expect(leads[0].confidenceTier).toBe('medium');
    });

    it('assigns low confidence for low engagement', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'lowuser',
            tweetText: 'Low engagement tweet',
            likes: 3,
            retweets: 1,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('test');

      expect(leads[0].confidenceTier).toBe('low');
    });
  });

  describe('score calculation', () => {
    it('calculates score based on likes and retweets', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'testuser',
            tweetText: 'Test tweet',
            likes: 25, // 25/2.5 = 10 points
            retweets: 10, // 10 points
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('test');

      // 10 (likes) + 10 (retweets) + 10 (tweet text) + 10 (handle) = 40
      expect(leads[0].score).toBe(40);
    });

    it('caps likes contribution at 40', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'popularuser',
            tweetText: 'Very popular tweet',
            likes: 500, // Should cap at 40 points
            retweets: 5,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('test');

      // 40 (capped likes) + 5 (retweets) + 10 (text) + 10 (handle) = 65
      expect(leads[0].score).toBe(65);
    });

    it('caps retweets contribution at 30', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'viraluser',
            tweetText: 'Viral tweet',
            likes: 10, // 10/2.5 = 4 points
            retweets: 100, // Should cap at 30 points
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('test');

      // 4 (likes) + 30 (capped retweets) + 10 (text) + 10 (handle) = 54
      expect(leads[0].score).toBe(54);
    });

    it('caps total score at 100', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'maxuser',
            tweetText: 'Max engagement tweet',
            likes: 1000,
            retweets: 500,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('test');

      expect(leads[0].score).toBeLessThanOrEqual(100);
    });

    it('gives low score for minimal engagement', async () => {
      const twitterData = {
        results: [
          {
            twitterHandle: 'lowuser',
            tweetText: 'Low engagement',
            likes: 2,
            retweets: 0,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitterAsLeads('test');

      // 0 (2/2.5 = 0.8 floored) + 0 (retweets) + 10 (text) + 10 (handle) = 20
      expect(leads[0].score).toBe(20);
    });
  });

  describe('integration: search for agent-browser vercel', () => {
    it('returns results with @handles for agent-browser vercel search (mock)', async () => {
      // This test verifies the expected output format for the acceptance criteria
      const twitterData = {
        results: [
          {
            twitterHandle: '@verlocker',
            tweetText: 'Just discovered agent-browser from Vercel - incredible for automated testing!',
            likes: 245,
            retweets: 67,
          },
          {
            twitterHandle: 'webdevpro',
            tweetText: 'Using agent-browser vercel for my CI/CD pipeline, game changer',
            likes: 89,
            retweets: 23,
          },
          {
            twitterHandle: '@automationlabs',
            tweetText: 'agent-browser + vercel deploy = seamless testing workflow',
            likes: 156,
            retweets: 41,
          },
          {
            twitterHandle: 'testingguru',
            tweetText: 'Checking out agent-browser by vercel',
            likes: 12,
            retweets: 3,
          },
        ],
      };

      mockQuery.mockImplementation(async function* () {
        yield { result: JSON.stringify(twitterData) };
      });

      const leads = await searchTwitter('agent-browser vercel');

      expect(leads.length).toBeGreaterThanOrEqual(3);

      // Verify each lead has required fields and handles are properly formatted
      for (const lead of leads) {
        expect(lead).toHaveProperty('twitterHandle');
        expect(lead).toHaveProperty('tweetText');
        expect(lead).toHaveProperty('likes');
        expect(lead).toHaveProperty('retweets');
        expect(typeof lead.twitterHandle).toBe('string');
        expect(lead.twitterHandle).not.toMatch(/^@/); // @ should be stripped
        expect(typeof lead.tweetText).toBe('string');
        expect(typeof lead.likes).toBe('number');
        expect(typeof lead.retweets).toBe('number');
      }
    });
  });
});
