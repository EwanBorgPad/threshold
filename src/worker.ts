/**
 * Cloudflare Workers entry point for MetaDAO Threshold Tracker
 * 
 * This worker handles:
 * 1. Scheduled cron triggers (hourly updates)
 * 2. Manual trigger endpoint
 * 3. Health check endpoint
 * 
 * Note: Puppeteer is not available in Workers, so it will fall back to other methods
 */

import { fetchProposalData } from "./metadao.js";
import { recordThreshold, getThresholdReport, formatReport } from "./tracker.js";

// Helper to send Telegram message via API (no polling needed)
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Telegram API error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

// Main function to send threshold update
async function sendThresholdUpdate(env: any): Promise<boolean> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Missing Telegram configuration");
    return false;
  }

  try {
    // Set environment for config
    if (env.PROPOSAL_PUBKEY) {
      process.env.PROPOSAL_PUBKEY = env.PROPOSAL_PUBKEY;
    }
    if (env.SOLANA_RPC_URL) {
      process.env.SOLANA_RPC_URL = env.SOLANA_RPC_URL;
    }

    // Fetch current proposal data
    const data = await fetchProposalData();

    if (!data) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "⚠️ Unable to fetch proposal data. Will retry next hour."
      );
      return false;
    }

    // Record the threshold for history
    recordThreshold(data);

    // Generate report with variation
    const report = getThresholdReport(data);
    const message = formatReport(report);

    const success = await sendTelegramMessage(botToken, chatId, message);
    
    if (success) {
      console.log(`Threshold update sent to ${chatId}`);
    }
    
    return success;
  } catch (error) {
    console.error("Error sending threshold update:", error);
    return false;
  }
}

// Worker export for Cloudflare
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    if (url.pathname === "/trigger" && request.method === "POST") {
      // Manual trigger endpoint
      try {
        const success = await sendThresholdUpdate(env);

        return new Response(
          JSON.stringify({
            success,
            message: success ? "Update sent" : "Update failed",
          }),
          {
            status: success ? 200 : 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response("MetaDAO Threshold Tracker Worker", { status: 200 });
  },

  // Cron trigger handler (runs hourly)
  async scheduled(
    event: any, // ScheduledEvent from @cloudflare/workers-types
    env: any,
    ctx: any // ExecutionContext from @cloudflare/workers-types
  ): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] Running scheduled threshold update...`
    );

    try {
      const success = await sendThresholdUpdate(env);

      if (!success) {
        console.error("Scheduled update failed");
      } else {
        console.log("Scheduled update completed successfully");
      }
    } catch (error: any) {
      console.error("Error in scheduled update:", error);
    }
  },
};
