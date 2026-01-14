# Deploying to Railway

Railway is the easiest platform for deploying this bot with full Puppeteer support.

## Prerequisites

1. A GitHub account
2. A Railway account (sign up at [railway.app](https://railway.app))
3. Your code pushed to a GitHub repository

## Step-by-Step Deployment

### 1. Push Your Code to GitHub

If you haven't already:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will automatically detect it's a Node.js project

### 3. Configure Environment Variables ⚠️ CRITICAL

**This is the most important step!** The bot will crash without these variables.

In your Railway project:

1. Click on your service
2. Go to the **Variables** tab (or **Settings** → **Variables**)
3. Click **"New Variable"** or **"Raw Editor"**
4. Add these environment variables (one per line in Raw Editor, or use the form):

**Required:**
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

**Optional (has defaults):**
```
PROPOSAL_PUBKEY=6cdhy4j6CAAJjE1z2iQDsFda2BrqJkhtHrRWT9QasSoa
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

**Important Notes:**
- ✅ No quotes needed around values
- ✅ No spaces around the `=` sign
- ✅ Railway will automatically redeploy after adding variables
- ✅ Variables are case-sensitive

**Troubleshooting:**
- If you see "TELEGRAM_BOT_TOKEN is required" error, the variables aren't set correctly
- Double-check spelling (no typos)
- Make sure you're adding them to the correct service
- After adding, Railway should auto-redeploy

### 4. Configure Build Settings

Railway should auto-detect, but verify:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Root Directory:** `.` (root)

### 5. Deploy

Railway will automatically:
1. Install dependencies
2. Build the project (`npm run build`)
3. Start the bot (`npm start`)

The bot will:
- Send an initial status update on startup
- Run hourly updates automatically via `node-cron`

## Monitoring

### View Logs

1. Go to your Railway project
2. Click on your service
3. View logs in the **Deployments** tab

### Check Status

The bot will show in logs:
- "Starting MetaDAO Threshold Tracker..."
- "Telegram bot initialized"
- "Sending initial status update..."
- "Hourly updates scheduled (every hour at minute 0)"

## Troubleshooting

### "TELEGRAM_BOT_TOKEN is required" Error

If you see this error even though variables are set:

1. **Check Variable Location:**
   - Variables must be set at the **Service level**, not just Project level
   - Go to your service → Variables tab
   - Make sure variables are listed there

2. **Verify Variable Names:**
   - Must be exactly: `TELEGRAM_BOT_TOKEN` (case-sensitive)
   - Must be exactly: `TELEGRAM_CHAT_ID` (case-sensitive)
   - No extra spaces or quotes

3. **Check Railway Logs:**
   - After the next deploy, check logs
   - You should see: "Environment variables check:" with ✓ or ✗
   - This will show which variables are missing

4. **Redeploy After Adding Variables:**
   - Railway should auto-redeploy, but you can manually trigger:
   - Go to Deployments → Click "Redeploy"

5. **Common Issues:**
   - Variables set at Project level instead of Service level
   - Typos in variable names (check for extra spaces)
   - Variables not saved (make sure to click Save)

### Bot Not Starting

1. Check logs for errors
2. Verify environment variables are set correctly
3. Make sure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set at **Service level**

### Puppeteer Issues

Railway should handle Puppeteer automatically. If you see errors:
- Check that Puppeteer is installed: `npm list puppeteer`
- Railway's environment includes Chrome/Chromium for Puppeteer

### Rate Limiting

If you see 429 errors:
- The bot will automatically retry on the next hourly run
- Puppeteer should bypass most rate limits

## Railway Free Tier

Railway offers:
- $5 free credit per month
- Sufficient for this bot (runs 24/7, minimal resource usage)
- Auto-sleeps after inactivity (but cron jobs will wake it)

## Updating the Bot

1. Push changes to GitHub
2. Railway automatically detects and redeploys
3. Or manually trigger a redeploy from Railway dashboard

## Cost Estimate

- **CPU:** Minimal (mostly idle, spikes during hourly updates)
- **Memory:** ~200-300MB (Puppeteer needs memory)
- **Network:** Minimal (API calls + Telegram messages)
- **Estimated cost:** Well within free tier limits

## Alternative: Railway Pro

If you need:
- No sleep (always-on)
- More resources
- Better performance

Upgrade to Railway Pro ($5/month + usage)
