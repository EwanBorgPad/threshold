import dotenv from "dotenv";

// Load .env file if it exists (for local development)
// In Railway/production, environment variables are set directly
dotenv.config();

// Debug: Log environment variables (without exposing secrets)
if (process.env.NODE_ENV !== "production") {
  console.log("Environment check:");
  console.log("TELEGRAM_BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "✓ Set" : "✗ Missing");
  console.log("TELEGRAM_CHAT_ID:", process.env.TELEGRAM_CHAT_ID ? "✓ Set" : "✗ Missing");
  console.log("PROPOSAL_PUBKEY:", process.env.PROPOSAL_PUBKEY || "Using default");
  console.log("SOLANA_RPC_URL:", process.env.SOLANA_RPC_URL || "Using default");
}

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
  // Check all environment variables for debugging
  const envVars = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    PROPOSAL_PUBKEY: process.env.PROPOSAL_PUBKEY,
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
  };

  console.log("Environment variables check:");
  console.log("- TELEGRAM_BOT_TOKEN:", envVars.TELEGRAM_BOT_TOKEN ? `Set (${envVars.TELEGRAM_BOT_TOKEN.length} chars)` : "❌ MISSING");
  console.log("- TELEGRAM_CHAT_ID:", envVars.TELEGRAM_CHAT_ID ? `Set (${envVars.TELEGRAM_CHAT_ID})` : "❌ MISSING");
  console.log("- PROPOSAL_PUBKEY:", envVars.PROPOSAL_PUBKEY || "Using default");
  console.log("- SOLANA_RPC_URL:", envVars.SOLANA_RPC_URL || "Using default");

  if (!config.telegram.botToken) {
    console.error("❌ TELEGRAM_BOT_TOKEN is missing from process.env");
    console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes("TELEGRAM") || k.includes("PROPOSAL") || k.includes("SOLANA")));
    throw new Error("TELEGRAM_BOT_TOKEN is required. Please set it in Railway Variables.");
  }
  if (!config.telegram.chatId) {
    console.error("❌ TELEGRAM_CHAT_ID is missing from process.env");
    console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes("TELEGRAM") || k.includes("PROPOSAL") || k.includes("SOLANA")));
    throw new Error("TELEGRAM_CHAT_ID is required. Please set it in Railway Variables.");
  }
}
