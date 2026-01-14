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

    await bot.sendMessage(targetChatId, message, { parse_mode: "Markdown" });
    console.log(`Threshold update sent to ${targetChatId}`);
    return true;
  } catch (error) {
    console.error("Error sending threshold update:", error);
    return false;
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
