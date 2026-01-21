import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDailySourcing, type SourcingResult } from './orchestrator.js';
import type { Lead } from './observer.js';
import type { SeedRepo } from './config/seed-repos.js';

// Mock the researchers
vi.mock('./researchers/github-researcher.js', () => ({
  researchRepo: vi.fn(),
}));

vi.mock('./researchers/hn-researcher.js', () => ({
  searchHNAsLeads: vi.fn(),
}));

vi.mock('./researchers/twitter-researcher.js', () => ({
  searchTwitterAsLeads: vi.fn(),
}));

// Mock the observer
vi.mock('./observer.js', () => ({
  validateLeads: vi.fn(),
}));

import { researchRepo } from './researchers/github-researcher.js';
import { searchHNAsLeads } from './researchers/hn-researcher.js';
import { searchTwitterAsLeads } from './researchers/twitter-researcher.js';
import { validateLeads } from './observer.js';

const mockResearchRepo = researchRepo as ReturnType<typeof vi.fn>;
const mockSearchHNAsLeads = searchHNAsLeads as ReturnType<typeof vi.fn>;
const mockSearchTwitterAsLeads = searchTwitterAsLeads as ReturnType<typeof vi.fn>;
const mockValidateLeads = validateLeads as ReturnType<typeof vi.fn>;

describe('orchestrator', () => {
  // Mock Convex client
  const mockUpsertProspect = vi.fn();
  const mockLogSourcingRun = vi.fn();
  const mockConvexClient = {
    upsertProspect: mockUpsertProspect,
    logSourcingRun: mockLogSourcingRun,
  };

  const testSeedRepos: SeedRepo[] = [
    { url: 'https://github.com/test-org/test-repo', category: 'agents' },
  ];

  const createMockLead = (overrides: Partial<Lead> = {}): Lead => ({
    githubUsername: 'testuser',
    discoveredFrom: ['github-contributors:test-org/test-repo'],
    confidenceTier: 'medium',
    score: 50,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockResearchRepo.mockResolvedValue([]);
    mockSearchHNAsLeads.mockResolvedValue([]);
    mockSearchTwitterAsLeads.mockResolvedValue([]);
    mockValidateLeads.mockImplementation(async (json: string) => {
      try {
        return JSON.parse(json);
      } catch {
        return null;
      }
    });
    mockUpsertProspect.mockResolvedValue(undefined);
    mockLogSourcingRun.mockResolvedValue(undefined);
  });

  describe('runDailySourcing', () => {
    it('spawns all three researchers for each seed repo', async () => {
      await runDailySourcing(testSeedRepos, { convexClient: mockConvexClient });

      expect(mockResearchRepo).toHaveBeenCalledWith('test-org/test-repo');
      expect(mockSearchHNAsLeads).toHaveBeenCalledWith('test-repo');
      expect(mockSearchTwitterAsLeads).toHaveBeenCalledWith('test-repo');
    });

    it('runs researchers in parallel for multiple repos', async () => {
      const multipleRepos: SeedRepo[] = [
        { url: 'https://github.com/org1/repo1', category: 'agents' },
        { url: 'https://github.com/org2/repo2', category: 'sdks' },
      ];

      await runDailySourcing(multipleRepos, { convexClient: mockConvexClient });

      // Each repo should trigger all 3 researchers
      expect(mockResearchRepo).toHaveBeenCalledTimes(2);
      expect(mockSearchHNAsLeads).toHaveBeenCalledTimes(2);
      expect(mockSearchTwitterAsLeads).toHaveBeenCalledTimes(2);
    });

    it('collects leads from all researchers', async () => {
      const githubLead = createMockLead({
        githubUsername: 'github-user',
        discoveredFrom: ['github-contributors:test-org/test-repo'],
      });
      const hnLead = createMockLead({
        githubUsername: 'hn-user',
        discoveredFrom: ['hacker-news:test-repo'],
      });
      const twitterLead = createMockLead({
        githubUsername: 'twitter-user',
        discoveredFrom: ['twitter:test-repo'],
      });

      mockResearchRepo.mockResolvedValue([githubLead]);
      mockSearchHNAsLeads.mockResolvedValue([hnLead]);
      mockSearchTwitterAsLeads.mockResolvedValue([twitterLead]);

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      expect(result.totalLeadsFound).toBe(3);
      expect(result.leadsBySource.github).toBe(1);
      expect(result.leadsBySource.hackernews).toBe(1);
      expect(result.leadsBySource.twitter).toBe(1);
    });

    it('merges duplicate leads from different sources', async () => {
      const githubLead = createMockLead({
        githubUsername: 'sameuser',
        name: 'Same User',
        email: 'same@example.com',
        discoveredFrom: ['github-contributors:test-org/test-repo'],
      });
      const twitterLead = createMockLead({
        githubUsername: 'sameuser', // Same username
        twitterHandle: 'sameuser',
        discoveredFrom: ['twitter:test-repo'],
      });

      mockResearchRepo.mockResolvedValue([githubLead]);
      mockSearchTwitterAsLeads.mockResolvedValue([twitterLead]);

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      // Should merge into 1 lead
      expect(result.totalLeadsFound).toBe(1);

      // Verify merged lead has both sources
      expect(mockValidateLeads).toHaveBeenCalled();
      const validatedCall = mockValidateLeads.mock.calls[0][0];
      const parsedLead = JSON.parse(validatedCall)[0];
      expect(parsedLead.discoveredFrom).toContain(
        'github-contributors:test-org/test-repo'
      );
      expect(parsedLead.discoveredFrom).toContain('twitter:test-repo');
    });

    it('passes leads through observer/validator', async () => {
      const lead = createMockLead();
      mockResearchRepo.mockResolvedValue([lead]);

      await runDailySourcing(testSeedRepos, { convexClient: mockConvexClient });

      expect(mockValidateLeads).toHaveBeenCalled();
    });

    it('persists valid leads to Convex', async () => {
      const lead = createMockLead({
        githubUsername: 'persistuser',
        name: 'Persist User',
        email: 'persist@example.com',
      });
      mockResearchRepo.mockResolvedValue([lead]);

      await runDailySourcing(testSeedRepos, { convexClient: mockConvexClient });

      expect(mockUpsertProspect).toHaveBeenCalledWith(
        expect.objectContaining({
          githubUsername: 'persistuser',
          name: 'Persist User',
          email: 'persist@example.com',
        })
      );
    });

    it('logs sourcing run to Convex', async () => {
      mockResearchRepo.mockResolvedValue([createMockLead()]);

      await runDailySourcing(testSeedRepos, { convexClient: mockConvexClient });

      expect(mockLogSourcingRun).toHaveBeenCalledWith(
        expect.objectContaining({
          startedAt: expect.any(Number),
          completedAt: expect.any(Number),
          prospectsFound: expect.any(Number),
          errors: expect.any(Array),
        })
      );
    });

    it('handles researcher errors gracefully', async () => {
      mockResearchRepo.mockRejectedValue(new Error('GitHub API error'));
      mockSearchHNAsLeads.mockResolvedValue([createMockLead()]);

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      expect(result.errors.some((e) => e.includes('GitHub researcher failed'))).toBe(
        true
      );
      // Should still process HN leads
      expect(result.leadsBySource.hackernews).toBe(1);
    });

    it('handles validation failures gracefully', async () => {
      const lead = createMockLead();
      mockResearchRepo.mockResolvedValue([lead]);
      mockValidateLeads.mockResolvedValue(null);

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      expect(result.totalLeadsPersisted).toBe(0);
    });

    it('handles Convex persistence errors gracefully', async () => {
      const lead = createMockLead();
      mockResearchRepo.mockResolvedValue([lead]);
      mockUpsertProspect.mockRejectedValue(new Error('Convex error'));

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      expect(result.errors.some((e) => e.includes('Failed to persist lead'))).toBe(
        true
      );
    });

    it('returns complete sourcing result', async () => {
      const lead = createMockLead();
      mockResearchRepo.mockResolvedValue([lead]);

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      expect(result).toMatchObject({
        startedAt: expect.any(Number),
        completedAt: expect.any(Number),
        totalLeadsFound: expect.any(Number),
        totalLeadsPersisted: expect.any(Number),
        errors: expect.any(Array),
        leadsBySource: {
          github: expect.any(Number),
          hackernews: expect.any(Number),
          twitter: expect.any(Number),
        },
      });
      expect(result.completedAt).toBeGreaterThanOrEqual(result.startedAt);
    });

    it('skips leads that fail validation', async () => {
      const validLead = createMockLead({ githubUsername: 'validuser' });
      const invalidLead = createMockLead({ githubUsername: 'invaliduser' });

      mockResearchRepo.mockResolvedValue([validLead, invalidLead]);
      mockValidateLeads
        .mockResolvedValueOnce([validLead]) // First call succeeds
        .mockResolvedValueOnce(null); // Second call fails

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      expect(result.totalLeadsPersisted).toBe(1);
      expect(mockUpsertProspect).toHaveBeenCalledTimes(1);
    });

  });

  describe('lead merging', () => {
    it('preserves data from first lead when merging', async () => {
      const githubLead = createMockLead({
        githubUsername: 'mergeuser',
        name: 'Merge User',
        email: 'merge@example.com',
        company: 'Merge Corp',
        discoveredFrom: ['github-contributors:test-org/test-repo'],
      });
      const twitterLead = createMockLead({
        githubUsername: 'mergeuser',
        twitterHandle: 'mergeuser',
        discoveredFrom: ['twitter:test-repo'],
      });

      mockResearchRepo.mockResolvedValue([githubLead]);
      mockSearchTwitterAsLeads.mockResolvedValue([twitterLead]);

      await runDailySourcing(testSeedRepos, { convexClient: mockConvexClient });

      // Check the validated lead has merged data
      const validatedCall = mockValidateLeads.mock.calls[0][0];
      const parsedLead = JSON.parse(validatedCall)[0];

      expect(parsedLead.name).toBe('Merge User');
      expect(parsedLead.email).toBe('merge@example.com');
      expect(parsedLead.company).toBe('Merge Corp');
      expect(parsedLead.twitterHandle).toBe('mergeuser');
    });

    it('fills in missing fields from subsequent leads', async () => {
      const githubLead = createMockLead({
        githubUsername: 'filluser',
        name: 'Fill User',
        discoveredFrom: ['github-contributors:test-org/test-repo'],
      });
      const twitterLead = createMockLead({
        githubUsername: 'filluser',
        twitterHandle: 'filluser',
        bio: 'Twitter bio',
        discoveredFrom: ['twitter:test-repo'],
      });

      mockResearchRepo.mockResolvedValue([githubLead]);
      mockSearchTwitterAsLeads.mockResolvedValue([twitterLead]);

      await runDailySourcing(testSeedRepos, { convexClient: mockConvexClient });

      const validatedCall = mockValidateLeads.mock.calls[0][0];
      const parsedLead = JSON.parse(validatedCall)[0];

      expect(parsedLead.name).toBe('Fill User');
      expect(parsedLead.twitterHandle).toBe('filluser');
      expect(parsedLead.bio).toBe('Twitter bio');
    });

    it('handles case-insensitive username matching', async () => {
      const githubLead = createMockLead({
        githubUsername: 'CaseUser',
        discoveredFrom: ['github-contributors:test-org/test-repo'],
      });
      const twitterLead = createMockLead({
        githubUsername: 'caseuser', // Different case
        twitterHandle: 'caseuser',
        discoveredFrom: ['twitter:test-repo'],
      });

      mockResearchRepo.mockResolvedValue([githubLead]);
      mockSearchTwitterAsLeads.mockResolvedValue([twitterLead]);

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      // Should merge into 1 lead
      expect(result.totalLeadsFound).toBe(1);
    });
  });

  describe('error handling', () => {
    it('handles missing CONVEX_URL when no client provided', async () => {
      // Remove CONVEX_URL from environment
      const originalUrl = process.env.CONVEX_URL;
      delete process.env.CONVEX_URL;

      const result = await runDailySourcing(testSeedRepos, {});

      expect(
        result.errors.some((e) => e.includes('CONVEX_URL environment variable is required'))
      ).toBe(true);
      expect(result.totalLeadsPersisted).toBe(0);

      // Restore
      if (originalUrl) {
        process.env.CONVEX_URL = originalUrl;
      }
    });

    it('continues processing when one researcher fails', async () => {
      mockResearchRepo.mockRejectedValue(new Error('GitHub error'));
      mockSearchHNAsLeads.mockRejectedValue(new Error('HN error'));
      mockSearchTwitterAsLeads.mockResolvedValue([createMockLead()]);

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      expect(result.errors).toHaveLength(2);
      expect(result.leadsBySource.twitter).toBe(1);
      expect(result.totalLeadsPersisted).toBe(1);
    });

    it('handles sourcingRun logging failure gracefully', async () => {
      mockResearchRepo.mockResolvedValue([createMockLead()]);
      mockLogSourcingRun.mockRejectedValue(new Error('Logging failed'));

      const result = await runDailySourcing(testSeedRepos, {
        convexClient: mockConvexClient,
      });

      expect(
        result.errors.some((e) => e.includes('Failed to log sourcing run'))
      ).toBe(true);
      // Should still return valid result
      expect(result.totalLeadsPersisted).toBe(1);
    });
  });
});
