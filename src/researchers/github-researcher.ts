/**
 * GitHub Researcher Module
 * Extracts contributors from GitHub repos using Claude Agent SDK
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Lead } from '../observer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GITHUB_RESEARCHER_PROMPT = readFileSync(
  join(__dirname, '../prompts/github-researcher.txt'),
  'utf-8'
);

interface GitHubContributor {
  username: string;
  name?: string;
  email?: string;
  emailSource?: string;
  company?: string;
  location?: string;
  bio?: string;
  twitter?: string;
  contributions: number;
}

interface AgentMessage {
  type?: string;
  result?: string;
}

/**
 * Research a GitHub repository and extract contributor information as leads
 * @param repo - Repository in format "owner/repo"
 * @returns Array of leads with contributor information
 */
export async function researchRepo(repo: string): Promise<Lead[]> {
  const prompt = `${GITHUB_RESEARCHER_PROMPT}

## Target Repository
${repo}

Research this repository and return the contributor data in the specified JSON format.`;

  let result = '';

  for await (const message of query({
    prompt,
    options: {
      allowedTools: ['Bash'],
      permissionMode: 'bypassPermissions',
    },
  }) as AsyncIterable<AgentMessage>) {
    if (message.result) {
      result = message.result;
    }
  }

  return parseContributorOutput(result, repo);
}

/**
 * Parse the agent output and convert to Lead format
 */
function parseContributorOutput(output: string, repo: string): Lead[] {
  // Try to extract JSON from the output
  const jsonMatch = output.match(/\{[\s\S]*"contributors"[\s\S]*\}/);
  if (!jsonMatch) {
    return [];
  }

  let data: { contributors: GitHubContributor[] };
  try {
    data = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  if (!data.contributors || !Array.isArray(data.contributors)) {
    return [];
  }

  return data.contributors.map((contributor): Lead => {
    const lead: Lead = {
      githubUsername: contributor.username,
      discoveredFrom: [`github-contributors:${repo}`],
      confidenceTier: determineConfidenceTier(contributor),
      score: calculateScore(contributor),
    };

    if (contributor.name) lead.name = contributor.name;
    if (contributor.email) {
      lead.email = contributor.email;
      lead.emailSource = contributor.emailSource ?? 'github-profile';
    }
    if (contributor.company) lead.company = contributor.company;
    if (contributor.location) lead.location = contributor.location;
    if (contributor.bio) lead.bio = contributor.bio;
    if (contributor.twitter) lead.twitterHandle = contributor.twitter;

    return lead;
  });
}

/**
 * Determine confidence tier based on available data
 */
function determineConfidenceTier(contributor: GitHubContributor): string {
  const hasEmail = !!contributor.email;
  const hasName = !!contributor.name;
  const hasCompany = !!contributor.company;
  const highContributions = contributor.contributions >= 10;

  if (hasEmail && hasName && (hasCompany || highContributions)) {
    return 'high';
  }
  if (hasName && (hasEmail || hasCompany || highContributions)) {
    return 'medium';
  }
  return 'low';
}

/**
 * Calculate a score based on contributor data completeness and activity
 */
function calculateScore(contributor: GitHubContributor): number {
  let score = 0;

  // Base score from contributions (max 40 points)
  score += Math.min(contributor.contributions * 2, 40);

  // Profile completeness (max 60 points)
  if (contributor.name) score += 15;
  if (contributor.email) score += 20;
  if (contributor.company) score += 10;
  if (contributor.location) score += 5;
  if (contributor.bio) score += 5;
  if (contributor.twitter) score += 5;

  return Math.min(score, 100);
}
