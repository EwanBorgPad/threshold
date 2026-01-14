import TelegramBot from "node-telegram-bot-api";
import { config } from "./config.js";
import { fetchProposalData } from "./metadao.js";
import { recordThreshold, getThresholdReport, formatReport } from "./tracker.js";

let bot: TelegramBot | null = null;

export function initializeBot(): TelegramBot {
  if (!config.telegram.botToken) {
    throw new Error("Telegram bot token not configured");
  }

  bot = new TelegramBot(config.telegram.botToken, { polling: true });

  // Verify chat ID on startup
  if (config.telegram.chatId) {
    verifyChatId(config.telegram.chatId).catch((error) => {
      console.error("Failed to verify chat ID:", error);
    });
  }

  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot!.sendMessage(
      chatId,
      `👋 Welcome to the MetaDAO Threshold Tracker!\n\n` +
        `This bot tracks the threshold for proposal:\n` +
        `\`${config.proposal.pubkey}\`\n\n` +
        `*Commands:*\n` +
        `/status - Get current threshold\n` +
        `/chatid - Get your chat ID (for config)\n\n` +
        `Hourly updates will be sent automatically.`,
      { parse_mode: "Markdown" }
    );
  });

  // Handle /status command
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    await sendThresholdUpdate(chatId.toString());
  });

  // Handle /chatid command
  bot.onText(/\/chatid/, async (msg) => {
    const chatId = msg.chat.id;
    await bot!.sendMessage(chatId, `Your chat ID is: \`${chatId}\``, {
      parse_mode: "Markdown",
    });
  });

  console.log("Telegram bot initialized");
  return bot;
}

export async function sendThresholdUpdate(
  chatId?: string
): Promise<boolean> {
  // If chatId is provided (e.g., from /status command), use it
  // Otherwise, use the configured chat ID from config (for scheduled updates)
  const targetChatId = chatId || config.telegram.chatId;

  if (!targetChatId) {
    console.error("No chat ID configured");
    return false;
  }

  // Log where the message is being sent
  if (chatId) {
    console.log(`Sending update to user chat: ${chatId} (command response)`);
  } else {
    console.log(`Sending update to configured chat: ${config.telegram.chatId} (scheduled update)`);
    // Check if chat ID looks like a group (negative) or user (positive)
    const chatIdNum = parseInt(config.telegram.chatId);
    if (chatIdNum > 0) {
      console.log(`   ℹ️  Note: Chat ID is positive (${chatIdNum}), which is typically a user ID.`);
      console.log(`   ℹ️  For group chats, the ID should be negative (e.g., -1001234567890)`);
      console.log(`   ℹ️  Make sure the bot has been started in the chat with /start`);
    } else {
      console.log(`   ℹ️  Chat ID is negative (${chatIdNum}), which indicates a group/channel`);
    }
  }

  if (!bot) {
    console.error("Bot not initialized");
    return false;
  }

  try {
    // Fetch current proposal data
    const data = await fetchProposalData();

    if (!data) {
      await bot.sendMessage(
        targetChatId,
        "⚠️ Unable to fetch proposal data. Will retry next hour.",
        { parse_mode: "Markdown" }
      );
      return false;
    }

    // Record the threshold for history
    recordThreshold(data);

    // Generate report with variation
    const report = getThresholdReport(data);
    const message = formatReport(report);

    const result = await bot.sendMessage(targetChatId, message, { parse_mode: "Markdown" });
    console.log(`✅ Threshold update sent successfully to ${targetChatId}`);
    console.log(`   Message ID: ${result.message_id}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error sending threshold update to ${targetChatId}:`, error.message || error);
    
    // Extract error details from Telegram API response
    const errorCode = error.response?.body?.error_code || error.response?.error_code;
    const errorDescription = error.response?.body?.description || error.response?.description;
    
    if (errorCode || errorDescription) {
      console.error(`   Error code: ${errorCode || "N/A"}`);
      console.error(`   Description: ${errorDescription || "N/A"}`);
      
      if (errorCode === 403) {
        console.error(`   ⚠️ Bot was blocked by user or not added to group/channel`);
        console.error(`   💡 Solution: Add the bot to the group/channel and make sure it has permission to send messages`);
      } else if (errorCode === 400) {
        console.error(`   ⚠️ Invalid chat ID or chat not found`);
        console.error(`   💡 Solution: Verify the chat ID is correct:`);
        console.error(`      npx tsx get-chat-id.ts --verify ${targetChatId}`);
        console.error(`   💡 Or get the correct chat ID:`);
        console.error(`      npx tsx get-chat-id.ts`);
      }
    }
    return false;
  }
}

async function verifyChatId(chatId: string): Promise<void> {
  if (!bot) return;

  try {
    const chat = await bot.getChat(chatId);
    console.log(`✅ Chat ID verified: ${chatId}`);
    console.log(`   Chat type: ${chat.type}`);
    console.log(`   Chat title: ${"title" in chat ? chat.title : "N/A"}`);
  } catch (error: any) {
    console.error(`❌ Cannot access chat ${chatId}:`, error.response?.description || error.message);
    if (error.response?.error_code === 400) {
      console.error(`   ⚠️  Chat not found. Make sure:`);
      console.error(`      - The bot has been added to the group/channel`);
      console.error(`      - The chat ID is correct`);
      console.error(`      - For groups, use the group chat ID (usually negative)`);
    } else if (error.response?.error_code === 403) {
      console.error(`   ⚠️  Bot was blocked or doesn't have access to this chat`);
    }
  }
}

export async function sendMessage(
  message: string,
  chatId?: string
): Promise<boolean> {
  const targetChatId = chatId || config.telegram.chatId;

  if (!targetChatId || !bot) {
    return false;
  }

  try {
    await bot.sendMessage(targetChatId, message, { parse_mode: "Markdown" });
    return true;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
}
