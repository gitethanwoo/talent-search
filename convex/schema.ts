import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  seedRepos: defineTable({
    name: v.string(),
    url: v.string(),
    category: v.string(),
    status: v.string(),
    dateAdded: v.number(),
  }),

  prospects: defineTable({
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
  })
    .index("by_github", ["githubUsername"])
    .index("by_tier", ["confidenceTier"])
    .index("by_status", ["status"]),

  outreachDrafts: defineTable({
    prospectId: v.id("prospects"),
    subject: v.string(),
    body: v.string(),
    status: v.string(),
    createdAt: v.number(),
  }),

  sourcingRuns: defineTable({
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    prospectsFound: v.number(),
    errors: v.array(v.string()),
  }),
});
