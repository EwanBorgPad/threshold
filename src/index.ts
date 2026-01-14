import cron from "node-cron";
import { config, validateConfig } from "./config.js";
import { initializeBot, sendThresholdUpdate, sendMessage } from "./telegram.js";

async function main() {
  console.log("Starting MetaDAO Threshold Tracker...");
  console.log(`Tracking proposal: ${config.proposal.pubkey}`);

  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.error("Configuration error:", error);
    process.exit(1);
  }

  // Initialize Telegram bot
  const bot = initializeBot();

  // Send initial status on startup
  console.log("Sending initial status update...");
  await sendThresholdUpdate();

  // Schedule hourly updates (at minute 0 of every hour)
  cron.schedule("0 * * * *", async () => {
    console.log(`[${new Date().toISOString()}] Running hourly threshold update...`);
    const success = await sendThresholdUpdate();
    if (!success) {
      console.error("Hourly update failed");
    }
  });

  console.log("Hourly updates scheduled (every hour at minute 0)");
  console.log("Bot is running. Press Ctrl+C to stop.");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await sendMessage("🔴 Bot shutting down...");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\nReceived SIGTERM, shutting down...");
    await sendMessage("🔴 Bot shutting down...");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
