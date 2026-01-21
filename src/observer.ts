/**
 * Observer/Validator module for validating agent output
 * Uses Claude Haiku to validate JSON schema before persisting
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Lead interface matching the prospects schema
 */
export interface Lead {
  githubUsername: string;
  name?: string;
  email?: string;
  emailSource?: string;
  twitterHandle?: string;
  company?: string;
  location?: string;
  bio?: string;
  discoveredFrom: string[];
  confidenceTier: string;
  score: number;
}

const VALIDATION_PROMPT = `You are a JSON schema validator. Your task is to validate that the provided JSON matches the expected Lead schema and contains no suspicious or malicious content.

Expected Lead schema:
{
  "githubUsername": string (required),
  "name": string (optional),
  "email": string (optional),
  "emailSource": string (optional),
  "twitterHandle": string (optional),
  "company": string (optional),
  "location": string (optional),
  "bio": string (optional),
  "discoveredFrom": string[] (required),
  "confidenceTier": string (required, should be one of: "high", "medium", "low"),
  "score": number (required, should be between 0 and 100)
}

Rules for validation:
1. The input must be valid JSON
2. It must be an array of Lead objects
3. Each Lead must have required fields: githubUsername, discoveredFrom, confidenceTier, score
4. Score must be a number between 0 and 100
5. confidenceTier should be "high", "medium", or "low"
6. No field should contain suspicious content like SQL injection, XSS payloads, or shell commands
7. GitHub usernames should match the pattern: alphanumeric with hyphens, no special characters
8. Emails if present should look like valid email addresses

Respond with ONLY a JSON object in this exact format:
{"valid": true, "leads": [...cleaned leads array...]}
or
{"valid": false, "reason": "explanation of what failed"}

Do not include any other text, markdown formatting, or explanation outside the JSON.`;

/**
 * Validates raw output from agents and returns cleaned leads if valid
 * @param rawOutput - Raw string output from an agent
 * @returns Cleaned array of leads if valid, null if invalid or suspicious
 */
export async function validateLeads(rawOutput: string): Promise<Lead[] | null> {
  // First, attempt basic JSON parsing
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawOutput);
  } catch {
    // Not valid JSON at all
    return null;
  }

  // Must be an array
  if (!Array.isArray(parsedJson)) {
    return null;
  }

  // Empty array is technically valid but not useful
  if (parsedJson.length === 0) {
    return [];
  }

  // Use Claude Haiku to validate schema and check for suspicious content
  const anthropic = new Anthropic();

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Validate this JSON array of leads:\n\n${rawOutput}`,
        },
      ],
      system: VALIDATION_PROMPT,
    });

    // Extract text response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return null;
    }

    // Parse validation response
    let validationResult: { valid: boolean; leads?: Lead[]; reason?: string };
    try {
      validationResult = JSON.parse(textContent.text);
    } catch {
      // Haiku didn't return valid JSON
      return null;
    }

    if (!validationResult.valid) {
      return null;
    }

    // Return cleaned leads
    return validationResult.leads ?? null;
  } catch {
    // API error or other failure
    return null;
  }
}
