/**
 * Twitter/Nitter Researcher Module
 * Searches for tweets about seed repositories using E2B sandbox with Claude Code
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Lead } from '../observer.js';
import { runInSandbox } from '../sandbox-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TWITTER_RESEARCHER_PROMPT = readFileSync(
  join(__dirname, '../prompts/twitter-researcher.txt'),
  'utf-8'
);

/**
 * Twitter Lead interface - specific to Twitter/Nitter results
 */
export interface TwitterLead {
  twitterHandle: string;
  tweetText: string;
  likes: number;
  retweets: number;
}

interface TweetResult {
  twitterHandle: string;
  tweetText: string;
  likes?: number;
  retweets?: number;
}

/**
 * Search Twitter via Nitter for tweets about a query term
 * @param searchQuery - The search term (e.g., "agent-browser vercel")
 * @param env - Environment variables for the sandbox (optional, defaults to process.env)
 * @returns Array of TwitterLead objects with Twitter-specific information
 */
export async function searchTwitter(
  searchQuery: string,
  env?: Record<string, string>
): Promise<TwitterLead[]> {
  const prompt = `${TWITTER_RESEARCHER_PROMPT}

## Search Query
${searchQuery}

Search Twitter via Nitter for tweets about "${searchQuery}" and return the results in the specified JSON format.`;

  const sandboxEnv = env ?? {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  };

  const result = await runInSandbox(prompt, sandboxEnv);

  return parseTwitterOutput(result);
}

/**
 * Search Twitter and convert results to standard Lead format
 * @param searchQuery - The search term
 * @param env - Environment variables for the sandbox (optional, defaults to process.env)
 * @returns Array of leads with Twitter discovery information
 */
export async function searchTwitterAsLeads(
  searchQuery: string,
  env?: Record<string, string>
): Promise<Lead[]> {
  const twitterLeads = await searchTwitter(searchQuery, env);
  return twitterLeads.map((twitterLead) => convertToLead(twitterLead, searchQuery));
}

/**
 * Parse the agent output and convert to TwitterLead format
 */
function parseTwitterOutput(output: string): TwitterLead[] {
  // Try to extract JSON from the output
  const jsonMatch = output.match(/\{[\s\S]*"results"[\s\S]*\}/);
  if (!jsonMatch) {
    return [];
  }

  let data: { results: TweetResult[] };
  try {
    data = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }

  return data.results
    .filter((tweet) => tweet.twitterHandle && tweet.twitterHandle.trim().length > 0)
    .map(
      (tweet): TwitterLead => ({
        twitterHandle: tweet.twitterHandle.replace(/^@/, ''), // Remove leading @ if present
        tweetText: tweet.tweetText || '',
        likes: tweet.likes || 0,
        retweets: tweet.retweets || 0,
      })
    );
}

/**
 * Convert a TwitterLead to the standard Lead format
 */
function convertToLead(twitterLead: TwitterLead, searchQuery: string): Lead {
  return {
    githubUsername: twitterLead.twitterHandle, // Twitter handle used as identifier
    twitterHandle: twitterLead.twitterHandle,
    discoveredFrom: [`twitter:${searchQuery}`],
    confidenceTier: determineConfidenceTier(twitterLead),
    score: calculateScore(twitterLead),
  };
}

/**
 * Determine confidence tier based on Twitter engagement
 */
function determineConfidenceTier(twitterLead: TwitterLead): string {
  const totalEngagement = twitterLead.likes + twitterLead.retweets;

  // High engagement = high confidence
  if (totalEngagement >= 100) {
    return 'high';
  }
  // Medium engagement
  if (totalEngagement >= 20 || twitterLead.likes >= 10) {
    return 'medium';
  }
  return 'low';
}

/**
 * Calculate a score based on Twitter engagement
 */
function calculateScore(twitterLead: TwitterLead): number {
  let score = 0;

  // Likes contribute up to 40 points (1 point per 2.5 likes, capped)
  score += Math.min(Math.floor(twitterLead.likes / 2.5), 40);

  // Retweets contribute up to 30 points (1 point per retweet, capped)
  score += Math.min(twitterLead.retweets, 30);

  // Having tweet text adds 10 points (validates data completeness)
  if (twitterLead.tweetText && twitterLead.tweetText.trim().length > 0) {
    score += 10;
  }

  // Having a handle adds 10 points (always present, but validates data)
  if (twitterLead.twitterHandle && twitterLead.twitterHandle.trim().length > 0) {
    score += 10;
  }

  return Math.min(score, 100);
}
