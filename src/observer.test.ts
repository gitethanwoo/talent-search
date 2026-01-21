import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateLeads, type Lead } from './observer';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

import Anthropic from '@anthropic-ai/sdk';

describe('validateLeads', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    }));
  });

  const validLead: Lead = {
    githubUsername: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    discoveredFrom: ['github-stars'],
    confidenceTier: 'high',
    score: 85,
  };

  describe('basic JSON validation', () => {
    it('returns null for invalid JSON', async () => {
      const result = await validateLeads('not valid json');
      expect(result).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns null for non-array JSON', async () => {
      const result = await validateLeads('{"key": "value"}');
      expect(result).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns empty array for empty JSON array', async () => {
      const result = await validateLeads('[]');
      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('Claude Haiku validation', () => {
    it('returns cleaned leads when validation passes', async () => {
      const validLeads = [validLead];
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ valid: true, leads: validLeads }),
          },
        ],
      });

      const result = await validateLeads(JSON.stringify(validLeads));

      expect(result).toEqual(validLeads);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-20250414',
        })
      );
    });

    it('returns null when validation fails', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ valid: false, reason: 'Invalid schema' }),
          },
        ],
      });

      const result = await validateLeads(JSON.stringify([{ bad: 'data' }]));

      expect(result).toBeNull();
    });

    it('returns null when Haiku returns non-JSON response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'I cannot process this request',
          },
        ],
      });

      const result = await validateLeads(JSON.stringify([validLead]));

      expect(result).toBeNull();
    });

    it('returns null when API call fails', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await validateLeads(JSON.stringify([validLead]));

      expect(result).toBeNull();
    });

    it('returns null when response has no text content', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      const result = await validateLeads(JSON.stringify([validLead]));

      expect(result).toBeNull();
    });
  });

  describe('multiple leads validation', () => {
    it('handles multiple valid leads', async () => {
      const multipleLeads: Lead[] = [
        validLead,
        {
          githubUsername: 'anotheruser',
          discoveredFrom: ['twitter'],
          confidenceTier: 'medium',
          score: 65,
        },
      ];

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ valid: true, leads: multipleLeads }),
          },
        ],
      });

      const result = await validateLeads(JSON.stringify(multipleLeads));

      expect(result).toEqual(multipleLeads);
      expect(result).toHaveLength(2);
    });
  });
});
