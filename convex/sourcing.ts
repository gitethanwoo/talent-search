"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Internal action to run daily sourcing in an E2B sandbox.
 * Called by the cron job.
 */
export const runDailySourcing = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; output?: string; error?: string }> => {
    // Dynamic import E2B since it's an external dependency
    const { Sandbox } = await import("e2b");

    const envVars = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      GH_TOKEN: process.env.GH_TOKEN ?? "",
      CONVEX_URL: process.env.CONVEX_URL ?? "",
    };

    // Validate required env vars
    if (!envVars.ANTHROPIC_API_KEY) {
      return { success: false, error: "ANTHROPIC_API_KEY not configured" };
    }
    if (!envVars.CONVEX_URL) {
      return { success: false, error: "CONVEX_URL not configured" };
    }

    let sbx;
    try {
      // Create sandbox with our pre-built template
      sbx = await Sandbox.create("tenex-sourcing", {
        envs: envVars,
        timeoutMs: 10 * 60 * 1000, // 10 minute timeout
      });

      // Clone the repo and run sourcing
      // Note: In production, you might bake this into the template
      const setupResult = await sbx.commands.run(
        "git clone https://github.com/your-org/tenex.git /app && cd /app && pnpm install",
        { timeoutMs: 5 * 60 * 1000 }
      );

      if (setupResult.exitCode !== 0) {
        return {
          success: false,
          error: `Setup failed: ${setupResult.stderr}`,
        };
      }

      // Run the sourcing command
      const result = await sbx.commands.run("cd /app && pnpm source", {
        timeoutMs: 8 * 60 * 1000,
      });

      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.exitCode !== 0 ? result.stderr : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Always clean up the sandbox
      if (sbx) {
        await sbx.kill();
      }
    }
  },
});

/**
 * Manual trigger for sourcing (useful for testing)
 */
export const triggerSourcing = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await ctx.runAction(internal.sourcing.runDailySourcing, {});

      if (result.success) {
        return {
          success: true,
          message: `Sourcing completed successfully. Output: ${result.output?.slice(0, 500)}...`,
        };
      } else {
        return {
          success: false,
          message: `Sourcing failed: ${result.error}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to run sourcing: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
