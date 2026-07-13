const milestoneService = require("../modules/escrow/services/milestone.service");

// Auto-release check interval: 1 hour (in milliseconds)
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Initialize the escrow auto-release scheduler.
 * Runs every hour to check for milestones that have passed their review deadline
 * without action from the project owner, and automatically releases payment.
 */
const initEscrowAutoRelease = () => {
  console.log("[Escrow Auto-Release] Scheduler initialized. Checking every 60 minutes.");

  // Run an initial check on startup (delayed by 30 seconds to let the app fully initialize)
  setTimeout(async () => {
    try {
      const count = await milestoneService.processAutoReleases();
      if (count > 0) {
        console.log(`[Escrow Auto-Release] Initial check: ${count} milestone(s) auto-released.`);
      }
    } catch (error) {
      console.error("[Escrow Auto-Release] Initial check failed:", error.message);
    }
  }, 30_000);

  // Schedule recurring checks
  setInterval(async () => {
    try {
      const count = await milestoneService.processAutoReleases();
      if (count > 0) {
        console.log(`[Escrow Auto-Release] ${count} milestone(s) auto-released.`);
      }
    } catch (error) {
      console.error("[Escrow Auto-Release] Scheduled check failed:", error.message);
    }
  }, CHECK_INTERVAL_MS);
};

module.exports = { initEscrowAutoRelease };
