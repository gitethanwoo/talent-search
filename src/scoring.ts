/**
 * Scoring module for lead signal strength evaluation
 * Scores leads based on contribution type, source count, and profile completeness
 */

import type { Lead } from './observer.js';

export type ContributionType =
  | 'merged_pr'
  | 'open_pr'
  | 'issue'
  | 'comment'
  | 'star'
  | 'unknown';

export type Tier = 'high' | 'mid' | 'low';

export interface ScoreResult {
  score: number;
  tier: Tier;
}

/**
 * Points awarded for each contribution type
 */
const CONTRIBUTION_SCORES: Record<ContributionType, number> = {
  merged_pr: 40,
  open_pr: 30,
  issue: 20,
  comment: 10,
  star: 5,
  unknown: 0,
};

/**
 * Bonus points for each additional source beyond the first
 */
const MULTI_SOURCE_BONUS = 10;

/**
 * Bonus points for profile completeness
 */
const PROFILE_BONUSES = {
  email: 8,
  twitter: 5,
  name: 3,
  company: 3,
  bio: 2,
  location: 2,
};

/**
 * Tier thresholds
 */
const TIER_THRESHOLDS = {
  high: 70,
  mid: 40,
};

/**
 * Extract contribution type from discoveredFrom sources
 * Parses patterns like "github-contributors:repo", "merged_pr:repo", etc.
 */
export function extractContributionType(discoveredFrom: string[]): ContributionType {
  for (const source of discoveredFrom) {
    const lowerSource = source.toLowerCase();

    if (lowerSource.includes('merged_pr') || lowerSource.includes('merged-pr')) {
      return 'merged_pr';
    }
    if (lowerSource.includes('open_pr') || lowerSource.includes('open-pr')) {
      return 'open_pr';
    }
    if (lowerSource.includes('issue')) {
      return 'issue';
    }
    if (lowerSource.includes('comment')) {
      return 'comment';
    }
    if (lowerSource.includes('star')) {
      return 'star';
    }
    // github-contributors implies merged PRs (active contributors)
    if (lowerSource.includes('github-contributors')) {
      return 'merged_pr';
    }
  }

  return 'unknown';
}

/**
 * Calculate the base score from contribution type
 */
function calculateContributionScore(discoveredFrom: string[]): number {
  const contributionType = extractContributionType(discoveredFrom);
  return CONTRIBUTION_SCORES[contributionType];
}

/**
 * Calculate bonus for multiple discovery sources
 */
function calculateMultiSourceBonus(discoveredFrom: string[]): number {
  const additionalSources = Math.max(0, discoveredFrom.length - 1);
  return additionalSources * MULTI_SOURCE_BONUS;
}

/**
 * Calculate bonus for profile completeness
 */
function calculateProfileBonus(lead: Lead): number {
  let bonus = 0;

  if (lead.email) {
    bonus += PROFILE_BONUSES.email;
  }
  if (lead.twitterHandle) {
    bonus += PROFILE_BONUSES.twitter;
  }
  if (lead.name) {
    bonus += PROFILE_BONUSES.name;
  }
  if (lead.company) {
    bonus += PROFILE_BONUSES.company;
  }
  if (lead.bio) {
    bonus += PROFILE_BONUSES.bio;
  }
  if (lead.location) {
    bonus += PROFILE_BONUSES.location;
  }

  return bonus;
}

/**
 * Determine tier based on score
 */
function determineTier(score: number): Tier {
  if (score >= TIER_THRESHOLDS.high) {
    return 'high';
  }
  if (score >= TIER_THRESHOLDS.mid) {
    return 'mid';
  }
  return 'low';
}

/**
 * Score a lead based on signal strength
 *
 * Scoring factors:
 * - Contribution type: merged_pr (40), open_pr (30), issue (20), comment (10), star (5)
 * - Multiple sources: +10 per additional source
 * - Profile completeness: email (+8), twitter (+5), name (+3), company (+3), bio (+2), location (+2)
 *
 * Tiers:
 * - high: 70+
 * - mid: 40-69
 * - low: <40
 *
 * @param lead - The lead to score
 * @returns Score result with numeric score and tier classification
 */
export function scoreLead(lead: Lead): ScoreResult {
  const contributionScore = calculateContributionScore(lead.discoveredFrom);
  const multiSourceBonus = calculateMultiSourceBonus(lead.discoveredFrom);
  const profileBonus = calculateProfileBonus(lead);

  const totalScore = contributionScore + multiSourceBonus + profileBonus;
  const tier = determineTier(totalScore);

  return {
    score: totalScore,
    tier,
  };
}
