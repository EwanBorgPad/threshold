#!/usr/bin/env node
/**
 * Helper script to get Telegram Chat ID using the Bot API
 * 
 * Usage:
 *   1. Make sure TELEGRAM_BOT_TOKEN is set in your .env file
 *   2. Send a message to your bot in Telegram (or add bot to group and send a message)
 *   3. Run: npx tsx get-chat-id.ts
 *   4. Or verify a specific chat ID: npx tsx get-chat-id.ts --verify <chat_id>
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

// Check if user wants to verify a specific chat ID
const args = process.argv.slice(2);
const verifyIndex = args.indexOf("--verify");
const chatIdToVerify = verifyIndex !== -1 && args[verifyIndex + 1] ? args[verifyIndex + 1] : null;

if (chatIdToVerify) {
  verifyChatId(chatIdToVerify);
} else {
  getChatIds();
}

function verifyChatId(chatId: string) {
  console.log(`🔍 Verifying chat ID: ${chatId}\n`);
  
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${chatId}`;
  
  https.get(url, (res) => {
    let data = "";
    
    res.on("data", (chunk) => {
      data += chunk;
    });
    
    res.on("end", () => {
      try {
        const response = JSON.parse(data);
        
        if (!response.ok) {
          console.error(`❌ Chat ID ${chatId} is invalid or bot cannot access it`);
          console.error(`   Error: ${response.description}`);
          console.error("\n💡 Possible reasons:");
          console.error("   - Bot hasn't been added to the group/channel");
          console.error("   - Chat ID is incorrect");
          console.error("   - Bot was removed from the group/channel");
          console.error("\n📝 To get the correct chat ID:");
          console.error("   1. Add the bot to your group/channel");
          console.error("   2. Send a message in the group (or have someone else send one)");
          console.error("   3. Run: npx tsx get-chat-id.ts");
          process.exit(1);
        }
        
        const chat = response.result;
        console.log("✅ Chat ID is valid!\n");
        console.log(`   Chat ID: ${chat.id}`);
        console.log(`   Type: ${chat.type}`);
        console.log(`   Title: ${chat.title || chat.first_name || "N/A"}`);
        if (chat.username) console.log(`   Username: @${chat.username}`);
        if (chat.description) console.log(`   Description: ${chat.description.substring(0, 100)}...`);
        
        console.log(`\n💡 Use this in your .env file:`);
        console.log(`   TELEGRAM_CHAT_ID=${chat.id}`);
      } catch (error) {
        console.error("❌ Error parsing response:", error);
        process.exit(1);
      }
    });
  }).on("error", (error) => {
    console.error("❌ Error verifying chat ID:", error.message);
    process.exit(1);
  });
}

function getChatIds() {
  const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`;

  console.log("🔍 Fetching updates from Telegram Bot API...");
  console.log("📝 Make sure you've sent at least one message to your bot!\n");
  console.log("   For groups: Add bot to group, then send a message in the group\n");

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
            console.log("\n   For groups:");
            console.log("   1. Add the bot to your group");
            console.log("   2. Send a message in the group (or have someone else send one)");
            console.log("   3. Run this script again");
            process.exit(1);
          }

          // Get unique chats from all updates with details
          const chats = new Map<number, any>();
          updates.forEach((update: any) => {
            if (update.message?.chat) {
              const chat = update.message.chat;
              if (!chats.has(chat.id)) {
                chats.set(chat.id, chat);
              }
            }
          });

          if (chats.size === 0) {
            console.log("⚠️  No chat IDs found in updates.");
            process.exit(1);
          }

          console.log("✅ Found chat(s):\n");
          chats.forEach((chat, chatId) => {
            const typeEmoji = chat.type === "private" ? "👤" : 
                            chat.type === "group" ? "👥" : 
                            chat.type === "supergroup" ? "👥" : 
                            chat.type === "channel" ? "📢" : "❓";
            
            console.log(`${typeEmoji} ${chat.type.toUpperCase()}`);
            console.log(`   Chat ID: ${chat.id}`);
            console.log(`   Title: ${chat.title || chat.first_name || "N/A"}`);
            if (chat.username) console.log(`   Username: @${chat.username}`);
            console.log(`   TELEGRAM_CHAT_ID=${chat.id}`);
            console.log("");
          });

          console.log("💡 Add one of these to your .env file:");
          const firstChatId = Array.from(chats.keys())[0];
          console.log(`   TELEGRAM_CHAT_ID=${firstChatId}\n`);
          
          console.log("💡 To verify a specific chat ID:");
          console.log(`   npx tsx get-chat-id.ts --verify ${firstChatId}\n`);
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
}
