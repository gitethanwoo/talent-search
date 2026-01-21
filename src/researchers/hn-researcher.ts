/**
 * Hacker News Researcher Module
 * Searches for discussions about seed repositories on HN using Claude Agent SDK
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Lead } from '../observer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HN_RESEARCHER_PROMPT = readFileSync(
  join(__dirname, '../prompts/hn-researcher.txt'),
  'utf-8'
);

/**
 * HN Lead interface - specific to Hacker News results
 */
export interface HNLead {
  hnUsername: string;
  storyTitle: string;
  points: number;
  url: string | null;
}

interface HNStory {
  title: string;
  author: string;
  points: number;
  url?: string | null;
}

interface AgentMessage {
  type?: string;
  result?: string;
}

/**
 * Search Hacker News for discussions about a query term
 * @param searchQuery - The search term (e.g., repository name like "agent-browser")
 * @returns Array of HNLead objects with HN-specific information
 */
export async function searchHN(searchQuery: string): Promise<HNLead[]> {
  const prompt = `${HN_RESEARCHER_PROMPT}

## Search Query
${searchQuery}

Search Hacker News for discussions about "${searchQuery}" and return the results in the specified JSON format.`;

  let result = '';

  for await (const message of query({
    prompt,
    options: {
      allowedTools: ['WebFetch'],
      permissionMode: 'bypassPermissions',
    },
  }) as AsyncIterable<AgentMessage>) {
    if (message.result) {
      result = message.result;
    }
  }

  return parseHNOutput(result);
}

/**
 * Search HN and convert results to standard Lead format
 * @param searchQuery - The search term
 * @returns Array of leads with HN discovery information
 */
export async function searchHNAsLeads(searchQuery: string): Promise<Lead[]> {
  const hnLeads = await searchHN(searchQuery);
  return hnLeads.map((hnLead) => convertToLead(hnLead, searchQuery));
}

/**
 * Parse the agent output and convert to HNLead format
 */
function parseHNOutput(output: string): HNLead[] {
  // Try to extract JSON from the output
  const jsonMatch = output.match(/\{[\s\S]*"results"[\s\S]*\}/);
  if (!jsonMatch) {
    return [];
  }

  let data: { results: HNStory[] };
  try {
    data = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }

  return data.results
    .filter((story) => story.author && story.author.trim().length > 0)
    .map(
      (story): HNLead => ({
        hnUsername: story.author,
        storyTitle: story.title,
        points: story.points || 0,
        url: story.url || null,
      })
    );
}

/**
 * Convert an HNLead to the standard Lead format
 */
function convertToLead(hnLead: HNLead, searchQuery: string): Lead {
  return {
    githubUsername: hnLead.hnUsername, // HN username used as identifier
    discoveredFrom: [`hacker-news:${searchQuery}`],
    confidenceTier: determineConfidenceTier(hnLead),
    score: calculateScore(hnLead),
  };
}

/**
 * Determine confidence tier based on HN engagement
 */
function determineConfidenceTier(hnLead: HNLead): string {
  // High engagement with URL = high confidence
  if (hnLead.points >= 100 && hnLead.url) {
    return 'high';
  }
  // Medium engagement or has URL
  if (hnLead.points >= 50 || hnLead.url) {
    return 'medium';
  }
  return 'low';
}

/**
 * Calculate a score based on HN engagement
 */
function calculateScore(hnLead: HNLead): number {
  let score = 0;

  // Points contribute up to 50 points (1 point per HN upvote, capped)
  score += Math.min(hnLead.points, 50);

  // Having a URL adds 20 points (shows external content)
  if (hnLead.url) {
    score += 20;
  }

  // Having a title adds 10 points (always present, but validates data)
  if (hnLead.storyTitle && hnLead.storyTitle.trim().length > 0) {
    score += 10;
  }

  return Math.min(score, 100);
}
