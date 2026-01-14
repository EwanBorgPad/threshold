import TelegramBot from "node-telegram-bot-api";
import { config } from "./config.js";
import { fetchProposalData } from "./metadao.js";
import { recordThreshold, getThresholdReport, formatReport } from "./tracker.js";

let bot: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (!bot) {
    if (!config.telegram.botToken) {
      throw new Error("Telegram bot token not configured");
    }
    bot = new TelegramBot(config.telegram.botToken, { polling: false });
  }
  return bot;
}

export async function sendThresholdUpdate(
  chatId?: string
): Promise<boolean> {
  const targetChatId = chatId || config.telegram.chatId;

  if (!targetChatId) {
    console.error("No chat ID configured");
    return false;
  }

  const botInstance = getBot();

  try {
    const data = await fetchProposalData();

    if (!data) {
      await botInstance.sendMessage(
        targetChatId,
        "⚠️ Unable to fetch proposal data.",
        { parse_mode: "Markdown" }
      );
      return false;
    }

    recordThreshold(data);
    const report = getThresholdReport(data);
    const message = formatReport(report);

    await botInstance.sendMessage(targetChatId, message, { parse_mode: "Markdown" });
    return true;
  } catch (error: any) {
    const errorCode = error.response?.body?.error_code || error.response?.error_code;
    const errorDescription = error.response?.body?.description || error.response?.description;
    
    if (errorCode === 400) {
      console.error(`Chat not found. Verify chat ID: npx tsx get-chat-id.ts --verify ${targetChatId}`);
    } else {
      console.error(`Error: ${errorDescription || error.message}`);
    }
    return false;
  }
}
