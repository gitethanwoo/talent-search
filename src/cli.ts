#!/usr/bin/env node
/**
 * CLI entry point for the lead sourcing agent
 * Supports daily sourcing runs and single repo scanning
 */

import 'dotenv/config';
import { runDailySourcing, type SourcingResult } from './orchestrator.js';
import { seedRepos, type SeedRepo } from './config/seed-repos.js';

/**
 * Parse command line arguments
 */
function parseArgs(): { repo?: string } {
  const args = process.argv.slice(2);
  const result: { repo?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) {
      result.repo = args[i + 1];
      i++;
    }
  }

  return result;
}

/**
 * Print summary of sourcing results
 */
function printSummary(result: SourcingResult): void {
  const duration = ((result.completedAt - result.startedAt) / 1000).toFixed(1);

  console.log('\n========================================');
  console.log('         SOURCING RUN COMPLETE         ');
  console.log('========================================\n');

  console.log(`Duration: ${duration}s`);
  console.log(`Total leads found: ${result.totalLeadsFound}`);
  console.log(`Total leads persisted: ${result.totalLeadsPersisted}`);

  console.log('\nLeads by source:');
  console.log(`  GitHub:      ${result.leadsBySource.github}`);
  console.log(`  Hacker News: ${result.leadsBySource.hackernews}`);
  console.log(`  Twitter:     ${result.leadsBySource.twitter}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  console.log('');
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs();

  console.log('Tenex Lead Sourcing Agent');
  console.log('-------------------------\n');

  let reposToScan: SeedRepo[];

  if (args.repo) {
    // Single repo mode
    console.log(`Scanning single repo: ${args.repo}\n`);

    // Determine category based on repo URL or default to 'ai-tools'
    const category = args.repo.includes('agent') ? 'agents' : 'ai-tools';
    reposToScan = [{ url: args.repo, category }];
  } else {
    // Daily sourcing mode - scan all seed repos
    console.log(`Running daily sourcing for ${seedRepos.length} seed repos:\n`);
    for (const repo of seedRepos) {
      console.log(`  - ${repo.url} (${repo.category})`);
    }
    console.log('');
    reposToScan = seedRepos;
  }

  try {
    const result = await runDailySourcing(reposToScan);
    printSummary(result);

    // Exit with error code if there were critical failures
    if (result.totalLeadsPersisted === 0 && result.errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during sourcing run:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
