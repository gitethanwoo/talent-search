import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Mutations

export const createSourcingRun = mutation({
  args: {
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    prospectsFound: v.number(),
    errors: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const runId = await ctx.db.insert("sourcingRuns", args);
    return runId;
  },
});

export const updateSourcingRun = mutation({
  args: {
    id: v.id("sourcingRuns"),
    completedAt: v.optional(v.number()),
    prospectsFound: v.optional(v.number()),
    errors: v.optional(v.array(v.string())),
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

// Queries

export const getLatestRuns = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const runs = await ctx.db
      .query("sourcingRuns")
      .order("desc")
      .take(limit);
    return runs;
  },
});

export const getRunById = query({
  args: {
    id: v.id("sourcingRuns"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    return run;
  },
});
