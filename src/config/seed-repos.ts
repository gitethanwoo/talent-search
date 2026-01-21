/**
 * Seed repository configuration for scanning
 */

export type RepoCategory = 'agents' | 'sdks' | 'ai-tools';

export interface SeedRepo {
  url: string;
  category: RepoCategory;
}

export const seedRepos: SeedRepo[] = [
  // Agents
  {
    url: 'https://github.com/vercel-labs/agent-browser',
    category: 'agents',
  },
  {
    url: 'https://github.com/vercel-labs/agent-skills',
    category: 'agents',
  },
  // AI Tools
  {
    url: 'https://github.com/vercel-labs/json-render',
    category: 'ai-tools',
  },
  {
    url: 'https://github.com/anthropics/claude-code',
    category: 'ai-tools',
  },
  // SDKs
  {
    url: 'https://github.com/vercel/ai',
    category: 'sdks',
  },
];
