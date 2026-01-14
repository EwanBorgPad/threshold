#!/usr/bin/env node
/**
 * Helper script to get Telegram Chat ID using the Bot API
 * 
 * Usage:
 *   1. Make sure TELEGRAM_BOT_TOKEN is set in your .env file
 *   2. Send a message to your bot in Telegram
 *   3. Run: npx tsx get-chat-id.ts
 */

import dotenv from "dotenv";
import https from "https";

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ Error: TELEGRAM_BOT_TOKEN not found in environment variables");
  console.error("   Please set it in your .env file");
  process.exit(1);
}

const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`;

console.log("🔍 Fetching updates from Telegram Bot API...");
console.log("📝 Make sure you've sent at least one message to your bot!\n");

https
  .get(API_URL, (res) => {
    let data = "";

    res.on("data", (chunk) => {
      data += chunk;
    });

    res.on("end", () => {
      try {
        const response = JSON.parse(data);

        if (!response.ok) {
          console.error("❌ API Error:", response.description);
          process.exit(1);
        }

        const updates = response.result;

        if (!updates || updates.length === 0) {
          console.log("⚠️  No updates found.");
          console.log("   Please send a message to your bot first, then run this script again.");
          process.exit(1);
        }

        // Get unique chat IDs from all updates
        const chatIds = new Set<number>();
        updates.forEach((update: any) => {
          if (update.message?.chat?.id) {
            chatIds.add(update.message.chat.id);
          }
        });

        if (chatIds.size === 0) {
          console.log("⚠️  No chat IDs found in updates.");
          process.exit(1);
        }

        console.log("✅ Found chat ID(s):\n");
        chatIds.forEach((chatId) => {
          console.log(`   TELEGRAM_CHAT_ID=${chatId}`);
        });

        console.log("\n💡 Add this to your .env file:");
        const firstChatId = Array.from(chatIds)[0];
        console.log(`   TELEGRAM_CHAT_ID=${firstChatId}\n`);
      } catch (error) {
        console.error("❌ Error parsing response:", error);
        process.exit(1);
      }
    });
  })
  .on("error", (error) => {
    console.error("❌ Error fetching updates:", error.message);
    process.exit(1);
  });
