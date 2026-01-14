# Alternative Deployment Platforms (Puppeteer Support Required)

Since **Puppeteer is essential** for fetching the threshold from MetaDAO (the APIs are rate-limited), you need a platform that supports browser automation.

## Recommended Platforms

### 1. **Railway** (Easiest) ⭐ Recommended
- ✅ Full Node.js support
- ✅ Puppeteer works out of the box
- ✅ Free tier available
- ✅ Simple deployment from GitHub

**Deploy:**
1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Add environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `PROPOSAL_PUBKEY` (optional)
   - `SOLANA_RPC_URL` (optional)

### 2. **Render**
- ✅ Free tier available
- ✅ Supports long-running processes
- ✅ Puppeteer works

**Deploy:**
1. Create a new Web Service
2. Connect GitHub repo
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variables

### 3. **Fly.io**
- ✅ Good for Docker containers
- ✅ Puppeteer support
- ✅ Free tier available

**Deploy:**
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. `fly launch`
3. Add secrets: `fly secrets set TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=xxx`

### 4. **DigitalOcean App Platform**
- ✅ Simple deployment
- ✅ Puppeteer support
- ⚠️ Paid (starts at $5/month)

### 5. **VPS (Hetzner, DigitalOcean, etc.)**
- ✅ Full control
- ✅ Puppeteer works
- ⚠️ Requires server management

**Setup:**
```bash
# On your VPS
git clone <your-repo>
cd threshold
npm install
npm run build
# Use PM2 or systemd to keep it running
pm2 start dist/index.js --name threshold-bot
pm2 save
pm2 startup
```

## Why Cloudflare Workers Won't Work

Cloudflare Workers:
- ❌ No browser automation (Puppeteer not supported)
- ❌ GraphQL API is rate-limited (429 errors)
- ❌ Simple HTML scraping is rate-limited (429 errors)
- ❌ Solana RPC shows proposal as "Passed" with closed markets

**Result:** Without Puppeteer, the bot cannot fetch the current threshold.

## Recommendation

Use **Railway** - it's the easiest and has a good free tier. The bot will work perfectly with Puppeteer there.
