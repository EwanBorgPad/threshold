# Deploying to Cloudflare Workers

## ⚠️ CRITICAL: Cloudflare Workers Won't Work

**Puppeteer is REQUIRED** to fetch the threshold from MetaDAO because:
- GraphQL API is rate-limited (429 errors)
- Simple HTML scraping is rate-limited (429 errors)  
- Solana RPC shows proposal as "Passed" with closed markets

**Cloudflare Workers does NOT support Puppeteer**, so the bot **will not work** on this platform.

## Use Alternative Platforms Instead

See **[DEPLOY-ALTERNATIVES.md](./DEPLOY-ALTERNATIVES.md)** for platforms that support Puppeteer:
- **Railway** (Recommended - easiest)
- Render
- Fly.io
- DigitalOcean App Platform
- VPS

---

## Cloudflare Workers Setup (For Reference Only)

⚠️ **Note:** This won't work without Puppeteer. Use a different platform instead.

The bot will fall back to:
1. GraphQL API (if available) - usually rate-limited
2. Simple HTML scraping (if not rate-limited) - usually rate-limited
3. Solana RPC - shows outdated "Passed" status

## Prerequisites

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Cloudflare Workers types (optional, for better TypeScript support):
```bash
npm install --save-dev @cloudflare/workers-types
```

   Note: If you don't install this, the build will still work, but you'll use `any` types for Workers-specific types.

2. Set environment variables in Cloudflare Dashboard:
   - Go to your Worker → Settings → Variables
   - Add these secrets:
     - `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
     - `TELEGRAM_CHAT_ID` - Your chat ID
     - `PROPOSAL_PUBKEY` - (Optional) Default: `6cdhy4j6CAAJjE1z2iQDsFda2BrqJkhtHrRWT9QasSoa`
     - `SOLANA_RPC_URL` - (Optional) Default: `https://api.mainnet-beta.solana.com`

   Or use Wrangler CLI:
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

## Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy to Cloudflare:
```bash
wrangler deploy
```

## Testing

1. Test the worker locally:
```bash
wrangler dev
```

2. Manually trigger an update:
```bash
curl -X POST https://your-worker.workers.dev/trigger
```

3. Check health:
```bash
curl https://your-worker.workers.dev/health
```

## Monitoring

View logs:
```bash
wrangler tail
```

## Cron Schedule

The worker is configured to run hourly (at minute 0 of every hour) via Cloudflare Cron Triggers.

## Alternative: Use a Different Platform

If you need Puppeteer support, consider:
- **Railway** - Easy deployment, supports Puppeteer
- **Render** - Free tier available, supports long-running processes
- **Fly.io** - Good for Docker containers
- **DigitalOcean App Platform** - Simple deployment
- **VPS** (Hetzner, DigitalOcean, etc.) - Full control

For these platforms, you can use the original `src/index.ts` with `node-cron`.
