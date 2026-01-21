import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily sourcing at 6:00 AM UTC
crons.daily(
  "daily-sourcing",
  { hourUTC: 6, minuteUTC: 0 },
  internal.sourcing.runDailySourcing
);

export default crons;
