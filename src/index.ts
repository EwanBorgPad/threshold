import { config, validateConfig } from "./config.js";
import { sendThresholdUpdate } from "./telegram.js";

async function main() {
  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.error("Configuration error:", error);
    process.exit(1);
  }

  // Send threshold update once and exit
  const success = await sendThresholdUpdate();
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
