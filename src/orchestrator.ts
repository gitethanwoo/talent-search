/**
 * Lead Agent Orchestrator
 * Coordinates all researchers and persists results for daily sourcing runs
 */

import { researchRepo } from './researchers/github-researcher.js';
import { searchHNAsLeads } from './researchers/hn-researcher.js';
import { searchTwitterAsLeads } from './researchers/twitter-researcher.js';
import { validateLeads, type Lead } from './observer.js';
import type { SeedRepo } from './config/seed-repos.js';

/**
 * Result of a single researcher run
 */
interface ResearcherResult {
  source: 'github' | 'hackernews' | 'twitter';
  repo: string;
  leads: Lead[];
  error?: string;
}

/**
 * Result of a complete daily sourcing run
 */
export interface SourcingResult {
  startedAt: number;
  completedAt: number;
  totalLeadsFound: number;
  totalLeadsPersisted: number;
  errors: string[];
  leadsBySource: {
    github: number;
    hackernews: number;
    twitter: number;
  };
}

/**
 * Convex HTTP API client for persisting leads
 */
interface ConvexClient {
  upsertProspect(lead: Lead): Promise<void>;
  logSourcingRun(run: {
    startedAt: number;
    completedAt: number;
    prospectsFound: number;
    errors: string[];
  }): Promise<void>;
}

/**
 * Extract repo name from URL for search queries
 * @param url - Full GitHub URL like "https://github.com/owner/repo"
 * @returns Just the "owner/repo" part
 */
function extractRepoPath(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  return match ? match[1] : url;
}

/**
 * Extract just the repo name for HN/Twitter searches
 * @param url - Full GitHub URL
 * @returns Just the repo name (last part)
 */
function extractRepoName(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

/**
 * Run GitHub researcher for a single repo
 */
async function runGitHubResearcher(repo: SeedRepo): Promise<ResearcherResult> {
  const repoPath = extractRepoPath(repo.url);
  try {
    const leads = await researchRepo(repoPath);
    return {
      source: 'github',
      repo: repoPath,
      leads,
    };
  } catch (error) {
    return {
      source: 'github',
      repo: repoPath,
      leads: [],
      error: `GitHub researcher failed for ${repoPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Run Hacker News researcher for a single repo
 */
async function runHNResearcher(repo: SeedRepo): Promise<ResearcherResult> {
  const repoName = extractRepoName(repo.url);
  try {
    const leads = await searchHNAsLeads(repoName);
    return {
      source: 'hackernews',
      repo: repoName,
      leads,
    };
  } catch (error) {
    return {
      source: 'hackernews',
      repo: repoName,
      leads: [],
      error: `HN researcher failed for ${repoName}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Run Twitter researcher for a single repo
 */
async function runTwitterResearcher(repo: SeedRepo): Promise<ResearcherResult> {
  const repoName = extractRepoName(repo.url);
  try {
    const leads = await searchTwitterAsLeads(repoName);
    return {
      source: 'twitter',
      repo: repoName,
      leads,
    };
  } catch (error) {
    return {
      source: 'twitter',
      repo: repoName,
      leads: [],
      error: `Twitter researcher failed for ${repoName}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Merge leads from multiple sources, combining discoveredFrom arrays for duplicates
 */
function mergeLeads(allLeads: Lead[]): Lead[] {
  const leadMap = new Map<string, Lead>();

  for (const lead of allLeads) {
    const key = lead.githubUsername.toLowerCase();
    const existing = leadMap.get(key);

    if (existing) {
      // Merge discoveredFrom arrays
      const mergedDiscoveredFrom = [
        ...new Set([...existing.discoveredFrom, ...lead.discoveredFrom]),
      ];

      // Keep the lead with more data, but merge discoveredFrom
      const merged: Lead = {
        ...existing,
        discoveredFrom: mergedDiscoveredFrom,
        // Update optional fields if the new lead has them and existing doesn't
        name: existing.name || lead.name,
        email: existing.email || lead.email,
        emailSource: existing.emailSource || lead.emailSource,
        twitterHandle: existing.twitterHandle || lead.twitterHandle,
        company: existing.company || lead.company,
        location: existing.location || lead.location,
        bio: existing.bio || lead.bio,
      };

      leadMap.set(key, merged);
    } else {
      leadMap.set(key, lead);
    }
  }

  return Array.from(leadMap.values());
}

/**
 * Create a default Convex HTTP API client
 */
function createConvexClient(convexUrl?: string): ConvexClient {
  const baseUrl = convexUrl || process.env.CONVEX_URL;
  if (!baseUrl) {
    throw new Error('CONVEX_URL environment variable is required');
  }

  return {
    async upsertProspect(lead: Lead): Promise<void> {
      const response = await fetch(`${baseUrl}/api/mutation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: 'prospects:upsertProspect',
          args: {
            githubUsername: lead.githubUsername,
            name: lead.name,
            email: lead.email,
            emailSource: lead.emailSource,
            twitterHandle: lead.twitterHandle,
            company: lead.company,
            location: lead.location,
            bio: lead.bio,
            discoveredFrom: lead.discoveredFrom,
            confidenceTier: lead.confidenceTier,
            score: lead.score,
            status: 'new',
            dateDiscovered: Date.now(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to upsert prospect: ${response.statusText}`);
      }
    },

    async logSourcingRun(run: {
      startedAt: number;
      completedAt: number;
      prospectsFound: number;
      errors: string[];
    }): Promise<void> {
      const response = await fetch(`${baseUrl}/api/mutation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: 'sourcingRuns:createSourcingRun',
          args: run,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to log sourcing run: ${response.statusText}`);
      }
    },
  };
}

/**
 * Run daily sourcing for all seed repos
 * Spawns researchers in parallel, validates, scores, and persists results
 *
 * @param seedRepos - Array of seed repositories to research
 * @param options - Optional configuration
 * @returns SourcingResult with statistics and any errors
 */
export async function runDailySourcing(
  seedRepos: SeedRepo[],
  options?: {
    convexClient?: ConvexClient;
    convexUrl?: string;
  }
): Promise<SourcingResult> {
  const startedAt = Date.now();
  const errors: string[] = [];
  const leadsBySource = {
    github: 0,
    hackernews: 0,
    twitter: 0,
  };

  // Create Convex client
  let convexClient: ConvexClient;
  try {
    convexClient = options?.convexClient || createConvexClient(options?.convexUrl);
  } catch (error) {
    errors.push(`Failed to create Convex client: ${error instanceof Error ? error.message : String(error)}`);
    return {
      startedAt,
      completedAt: Date.now(),
      totalLeadsFound: 0,
      totalLeadsPersisted: 0,
      errors,
      leadsBySource,
    };
  }

  // Spawn all researchers in parallel for each seed repo
  const researcherPromises: Promise<ResearcherResult>[] = [];

  for (const repo of seedRepos) {
    researcherPromises.push(runGitHubResearcher(repo));
    researcherPromises.push(runHNResearcher(repo));
    researcherPromises.push(runTwitterResearcher(repo));
  }

  // Wait for all researchers to complete
  const results = await Promise.all(researcherPromises);

  // Collect all leads and errors
  const allLeads: Lead[] = [];

  for (const result of results) {
    if (result.error) {
      errors.push(result.error);
    }

    allLeads.push(...result.leads);
    leadsBySource[result.source] += result.leads.length;
  }

  // Merge duplicate leads from multiple sources
  const mergedLeads = mergeLeads(allLeads);
  const totalLeadsFound = mergedLeads.length;

  // Validate leads through observer
  const validatedLeads: Lead[] = [];

  for (const lead of mergedLeads) {
    const validated = await validateLeads(JSON.stringify([lead]));

    if (validated && validated.length > 0) {
      validatedLeads.push(validated[0]);
    }
  }

  // Persist valid leads to Convex
  let totalLeadsPersisted = 0;

  for (const lead of validatedLeads) {
    try {
      await convexClient.upsertProspect(lead);
      totalLeadsPersisted++;
    } catch (error) {
      errors.push(
        `Failed to persist lead ${lead.githubUsername}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const completedAt = Date.now();

  // Log the sourcing run
  try {
    await convexClient.logSourcingRun({
      startedAt,
      completedAt,
      prospectsFound: totalLeadsPersisted,
      errors,
    });
  } catch (error) {
    errors.push(
      `Failed to log sourcing run: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    startedAt,
    completedAt,
    totalLeadsFound,
    totalLeadsPersisted,
    errors,
    leadsBySource,
  };
}
