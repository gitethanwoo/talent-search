import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Mutations

export const createProspect = mutation({
  args: {
    githubUsername: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailSource: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    bio: v.optional(v.string()),
    discoveredFrom: v.array(v.string()),
    confidenceTier: v.string(),
    score: v.number(),
    status: v.string(),
    dateDiscovered: v.number(),
  },
  handler: async (ctx, args) => {
    const prospectId = await ctx.db.insert("prospects", args);
    return prospectId;
  },
});

export const updateProspect = mutation({
  args: {
    id: v.id("prospects"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailSource: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    bio: v.optional(v.string()),
    discoveredFrom: v.optional(v.array(v.string())),
    confidenceTier: v.optional(v.string()),
    score: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

export const upsertProspect = mutation({
  args: {
    githubUsername: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailSource: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    bio: v.optional(v.string()),
    discoveredFrom: v.array(v.string()),
    confidenceTier: v.string(),
    score: v.number(),
    status: v.string(),
    dateDiscovered: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for existing prospect by githubUsername
    const existing = await ctx.db
      .query("prospects")
      .withIndex("by_github", (q) => q.eq("githubUsername", args.githubUsername))
      .unique();

    if (existing) {
      // Update existing prospect
      const { githubUsername, ...updates } = args;
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      // Create new prospect
      const prospectId = await ctx.db.insert("prospects", args);
      return prospectId;
    }
  },
});

// Queries

export const getProspectByGithub = query({
  args: {
    githubUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db
      .query("prospects")
      .withIndex("by_github", (q) => q.eq("githubUsername", args.githubUsername))
      .unique();
    return prospect;
  },
});

export const getProspectsByTier = query({
  args: {
    confidenceTier: v.string(),
  },
  handler: async (ctx, args) => {
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_tier", (q) => q.eq("confidenceTier", args.confidenceTier))
      .collect();
    return prospects;
  },
});

export const getProspectsByStatus = query({
  args: {
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
    return prospects;
  },
});
