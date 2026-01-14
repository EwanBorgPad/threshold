import dotenv from "dotenv";

dotenv.config();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
  },
  solana: {
    rpcUrl:
      process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  },
  proposal: {
    pubkey:
      process.env.PROPOSAL_PUBKEY ||
      "6cdhy4j6CAAJjE1z2iQDsFda2BrqJkhtHrRWT9QasSoa",
    projectSlug: "ranger",
  },
  metadaoApi: {
    baseUrl: "https://market-api.metadao.fi",
    graphqlUrl: "https://prod.backend.metadao.fi/v1/graphql",
  },
};

export function validateConfig(): void {
  if (!config.telegram.botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }
  if (!config.telegram.chatId) {
    throw new Error("TELEGRAM_CHAT_ID is required");
  }
}
