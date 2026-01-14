import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "./config.js";

export interface ProposalData {
  proposalPubkey: string;
  passPrice: number;
  failPrice: number;
  passTwap: number;
  failTwap: number;
  threshold: number;
  status: string;
  timestamp: Date;
}

interface GraphQLProposalResponse {
  data?: {
    proposals?: Array<{
      proposal_acct: string;
      status: string;
      pass_market_acct: string;
      fail_market_acct: string;
    }>;
    proposal_details?: Array<{
      proposal_acct: string;
      pass_price?: number;
      fail_price?: number;
      pass_twap?: number;
      fail_twap?: number;
    }>;
    twaps?: Array<{
      market_acct: string;
      token_amount: string;
      updated_slot: string;
    }>;
    prices?: Array<{
      market_acct: string;
      price: string;
    }>;
  };
}

// Known GraphQL endpoints to try (prioritize website API first)
const GRAPHQL_ENDPOINTS = [
  "https://www.metadao.fi/api/graphql",
  "https://prod.backend.metadao.fi/v1/graphql",
  "https://api.metadao.fi/v1/graphql",
  "https://indexer.metadao.fi/v1/graphql",
];

async function fetchFromGraphQL(): Promise<ProposalData | null> {
  const query = `
    query GetProposal($proposalAcct: String!) {
      proposals(where: { proposal_acct: { _eq: $proposalAcct } }) {
        proposal_acct
        status
        pass_market_acct
        fail_market_acct
      }
      proposal_details(where: { proposal_acct: { _eq: $proposalAcct } }) {
        proposal_acct
        pass_price
        fail_price
        pass_twap
        fail_twap
      }
    }
  `;

  for (const endpoint of GRAPHQL_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MetaDAO-Threshold-Tracker/1.0",
        },
        body: JSON.stringify({
          query,
          variables: { proposalAcct: config.proposal.pubkey },
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as GraphQLProposalResponse;

      if (data.data?.proposals?.[0] && data.data?.proposal_details?.[0]) {
        const proposal = data.data.proposals[0];
        const details = data.data.proposal_details[0];

        const passPrice = details.pass_price || 0;
        const failPrice = details.fail_price || 0;
        const threshold =
          failPrice > 0 ? ((passPrice - failPrice) / failPrice) * 100 : 0;

        return {
          proposalPubkey: proposal.proposal_acct,
          passPrice,
          failPrice,
          passTwap: details.pass_twap || passPrice,
          failTwap: details.fail_twap || failPrice,
          threshold,
          status: proposal.status,
          timestamp: new Date(),
        };
      } else if (data.data?.proposals?.[0]) {
        // Got proposal but no details - log what we have
      }
    } catch (error) {
    }
  }

  return null;
}

// Parsed proposal data from on-chain
interface ParsedProposal {
  number: number;
  proposer: PublicKey;
  timestampEnqueued: bigint;
  state: number;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  dao: PublicKey;
  pdaBump: number;
  question: PublicKey;
  durationInSeconds: number;
  squadsProposal: PublicKey;
  passBaseMint: PublicKey;
  passQuoteMint: PublicKey;
  failBaseMint: PublicKey;
  failQuoteMint: PublicKey;
  isTeamSponsored: boolean;
}

// Parse proposal account data from on-chain
// Based on Futarchy program Proposal struct
function parseProposalAccount(data: Buffer): ParsedProposal | null {
  try {
    // Account structure based on futarchy program:
    // 8 bytes discriminator
    // 4 bytes number (u32)
    // 32 bytes proposer (Pubkey)
    // 8 bytes timestamp_enqueued (i64)
    // 1 byte state (enum)
    // 32 bytes base_vault (Pubkey)
    // 32 bytes quote_vault (Pubkey)
    // 32 bytes dao (Pubkey)
    // 1 byte pda_bump (u8)
    // 32 bytes question (Pubkey)
    // 4 bytes duration_in_seconds (u32)
    // 32 bytes squads_proposal (Pubkey)
    // 32 bytes pass_base_mint (Pubkey)
    // 32 bytes pass_quote_mint (Pubkey)
    // 32 bytes fail_base_mint (Pubkey)
    // 32 bytes fail_quote_mint (Pubkey)
    // 1 byte is_team_sponsored (bool)

    const minSize = 8 + 4 + 32 + 8 + 1 + 32 + 32 + 32 + 1 + 32 + 4 + 32 + 32 + 32 + 32 + 32 + 1;
    if (data.length < minSize) {
      return null;
    }

    let offset = 8; // Skip discriminator

    const number = data.readUInt32LE(offset);
    offset += 4;

    const proposer = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const timestampEnqueued = data.readBigInt64LE(offset);
    offset += 8;

    const state = data.readUInt8(offset);
    offset += 1;

    const baseVault = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const quoteVault = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const dao = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const pdaBump = data.readUInt8(offset);
    offset += 1;

    const question = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const durationInSeconds = data.readUInt32LE(offset);
    offset += 4;

    const squadsProposal = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const passBaseMint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const passQuoteMint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const failBaseMint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const failQuoteMint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const isTeamSponsored = data.readUInt8(offset) !== 0;

    return {
      number,
      proposer,
      timestampEnqueued,
      state,
      baseVault,
      quoteVault,
      dao,
      pdaBump,
      question,
      durationInSeconds,
      squadsProposal,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      isTeamSponsored,
    };
  } catch (error) {
    return null;
  }
}

// State enum values
const PROPOSAL_STATE = {
  0: "Pending",
  1: "Passed",
  2: "Failed",
  3: "Executed",
} as const;

// Parse question account to get AMM addresses
function parseQuestionAccount(data: Buffer): { passAmm: PublicKey; failAmm: PublicKey } | null {
  try {
    // Question account structure:
    // 32 bytes - pass AMM address
    // 32 bytes - fail AMM address
    // remaining bytes - other data (oracle configuration, etc.)
    if (data.length < 64) {
      return null;
    }

    const passAmm = new PublicKey(data.subarray(0, 32));
    const failAmm = new PublicKey(data.subarray(32, 64));

    return { passAmm, failAmm };
  } catch (error) {
    return null;
  }
}

// Parse AMM (dAMM v2) account to get reserves
function parseAmmAccount(data: Buffer): { baseReserves: bigint; quoteReserves: bigint } | null {
  try {
    // dAMM v2 account structure varies, but reserves are typically stored
    // Let's try multiple offsets to find the reserves

    if (data.length < 100) {
      return null;
    }

    // Try common offsets for reserve data
    // The exact structure depends on the AMM program version
    const possibleOffsets = [
      8 + 32 * 6,  // After discriminator + 6 pubkeys
      8 + 32 * 5,  // After discriminator + 5 pubkeys
      data.length - 16,  // Near the end
    ];

    for (const offset of possibleOffsets) {
      if (offset + 16 <= data.length && offset >= 0) {
        const val1 = data.readBigUInt64LE(offset);
        const val2 = data.readBigUInt64LE(offset + 8);

        // Check if values look like reasonable reserves (non-zero, within token supply range)
        if (val1 > 1000n && val2 > 1000n && val1 < BigInt(10 ** 18) && val2 < BigInt(10 ** 18)) {
          return { baseReserves: val1, quoteReserves: val2 };
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function fetchFromSolanaRpc(): Promise<ProposalData | null> {
  try {
    const connection = new Connection(config.solana.rpcUrl, "confirmed");
    const proposalPubkey = new PublicKey(config.proposal.pubkey);

    const accountInfo = await connection.getAccountInfo(proposalPubkey);

    if (!accountInfo) {
      return null;
    }

    const proposal = parseProposalAccount(accountInfo.data);
    if (!proposal) {
      return null;
    }

    const stateStr = PROPOSAL_STATE[proposal.state as keyof typeof PROPOSAL_STATE] || "Unknown";

    // Fetch question account to get AMM addresses
    const questionInfo = await connection.getAccountInfo(proposal.question);
    if (!questionInfo) {
      return null;
    }

    const ammAddresses = parseQuestionAccount(questionInfo.data);
    if (!ammAddresses) {
      return null;
    }

    // Fetch AMM accounts in parallel
    const [passAmmInfo, failAmmInfo] = await Promise.all([
      connection.getAccountInfo(ammAddresses.passAmm),
      connection.getAccountInfo(ammAddresses.failAmm),
    ]);

    // Check if AMM accounts exist (they're closed when proposal finalizes)
    if (!passAmmInfo || !failAmmInfo) {
      if (proposal.state !== 0) {
        return null;
      }
      return null;
    }

    // Parse AMM accounts to get reserves
    const passReserves = parseAmmAccount(passAmmInfo.data);
    const failReserves = parseAmmAccount(failAmmInfo.data);

    if (!passReserves || !failReserves) {
      return null;
    }

    // Calculate prices from reserves
    // Price = quote_reserves / base_reserves
    // Both tokens typically have 6 decimals (USDC quote, conditional token base)
    const passPrice = Number(passReserves.quoteReserves) / Number(passReserves.baseReserves);
    const failPrice = Number(failReserves.quoteReserves) / Number(failReserves.baseReserves);

    if (passPrice > 0 && failPrice > 0) {
      const threshold = ((passPrice - failPrice) / failPrice) * 100;

      return {
        proposalPubkey: config.proposal.pubkey,
        passPrice,
        failPrice,
        passTwap: passPrice, // Using spot price as approximation for now
        failTwap: failPrice,
        threshold,
        status: stateStr.toLowerCase(),
        timestamp: new Date(),
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Fetch from webpage using Puppeteer (browser automation)
async function fetchFromWebpageWithPuppeteer(): Promise<ProposalData | null> {
  try {
    // Dynamically import puppeteer (optional dependency)
    let puppeteer: any;
    try {
      // @ts-ignore - Puppeteer is an optional dependency
      puppeteer = await import('puppeteer');
    } catch (e) {
      return null;
    }
    
    if (!puppeteer || !puppeteer.default) {
      return null;
    }

    const url = `https://www.metadao.fi/projects/${config.proposal.projectSlug}/proposal/${config.proposal.pubkey}`;
    
    let browser;
    try {
      browser = await puppeteer.default.launch({
        headless: "new", // Use new headless mode to avoid deprecation warning
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
        ],
      });
    } catch (error) {
      return null;
    }
    
    try {
      const page = await browser.newPage();
      
      // Set a realistic viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set user agent and other headers to look more like a real browser
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Remove webdriver property
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });
      
      // Navigate and handle Vercel challenge
      try {
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
        
        if (!response) {
          return null;
        }
        
        // Check if we hit a Vercel challenge page
        const pageTitle = await page.title();
        const pageUrl = page.url();
        
        if (pageTitle.includes('Vercel Security Checkpoint') || pageUrl.includes('challenge')) {
          // Wait for the challenge to complete (up to 30 seconds)
          try {
            await page.waitForNavigation({ 
              waitUntil: 'networkidle2', 
              timeout: 30000 
            });
          } catch (e) {
            // Challenge may still be processing
          }
        }
        
        // Wait for the actual content to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if we're still on a challenge page
        const currentTitle = await page.title();
        if (currentTitle.includes('Vercel Security Checkpoint')) {
          return null;
        }
        
      } catch (error) {
        return null;
      }
      
      // Verify we're on the right page
      const finalUrl = page.url();
      if (!finalUrl.includes('metadao.fi') || finalUrl.includes('challenge')) {
        return null;
      }
      
      // Get page text
      const pageText = await page.evaluate(() => document.body.innerText) as string;
      
      // Method 1: Try to get data from __NEXT_DATA__
      const nextData = await page.evaluate(() => {
        const script = document.getElementById('__NEXT_DATA__');
        if (script) {
          try {
            return JSON.parse(script.textContent || '{}');
          } catch (e) {
            return null;
          }
        }
        return null;
      });
      
      if (nextData) {
        // Recursively search for proposal data
        const findInObject = (obj: any, key: string): any => {
          if (obj && typeof obj === 'object') {
            if (key in obj) return obj[key];
            for (const k in obj) {
              const found = findInObject(obj[k], key);
              if (found !== undefined) return found;
            }
          }
          return undefined;
        };
        
        const proposalData = findInObject(nextData, 'proposal') || 
                            findInObject(nextData, 'proposalData') ||
                            findInObject(nextData, 'pageProps');
        
        if (proposalData && typeof proposalData === 'object') {
          const threshold = proposalData.threshold ?? proposalData.threshold_percent ?? null;
          const passPrice = proposalData.pass_price ?? proposalData.passPrice ?? null;
          const failPrice = proposalData.fail_price ?? proposalData.failPrice ?? null;
          
          if (threshold !== null) {
            return {
              proposalPubkey: config.proposal.pubkey,
              passPrice: passPrice || 0,
              failPrice: failPrice || 0,
              passTwap: passPrice || 0,
              failTwap: failPrice || 0,
              threshold: threshold,
              status: "active",
              timestamp: new Date(),
            };
          }
        }
      }
      
      // Method 2: Try to extract from visible text
      // Look for percentage patterns
      const percentagePattern = /([+-]?\d+\.\d{2,})\s*%/g;
      const percentages: RegExpMatchArray[] = Array.from(pageText.matchAll(percentagePattern));
      
      // Extract pass and fail prices from TWAP values
      let passPrice: number | null = null;
      let failPrice: number | null = null;
      let passTwap: number | null = null;
      let failTwap: number | null = null;
      
      // Look for "Approve TWAP$X.XXXX" and "Reject TWAP$X.XXXX"
      const approveTwapMatch = pageText.match(/approve\s+twap\s*\$?(\d+\.\d+)/i);
      const rejectTwapMatch = pageText.match(/reject\s+twap\s*\$?(\d+\.\d+)/i);
      
      if (approveTwapMatch) {
        passTwap = parseFloat(approveTwapMatch[1]);
        passPrice = passTwap;
      }
      
      if (rejectTwapMatch) {
        failTwap = parseFloat(rejectTwapMatch[1]);
        failPrice = failTwap;
      }
      
      // First, try to find the threshold near "APPROVED" or "Pass threshold" (this is the actual threshold)
      let foundThreshold: number | null = null;
      
      for (const match of percentages) {
        const value = parseFloat(match[1] as string);
        if (value >= -100 && value <= 100 && Math.abs(value) > 0.01) {
          const matchIndex = match.index as number;
          const matchLength = match[0].length;
          const context = pageText.substring(
            Math.max(0, matchIndex - 150),
            Math.min(pageText.length, matchIndex + matchLength + 150)
          ).toLowerCase();
          
          // Prioritize: Look for "approved" + percentage (this is the actual threshold)
          if (context.includes('approved') && value > 0) {
            foundThreshold = value;
            break;
          }
          
          // Also check for "pass threshold" context
          if (context.includes('pass threshold') && value > 0) {
            foundThreshold = value;
            break;
          }
        }
      }
      
      // If we have prices, verify threshold calculation
      if (passPrice !== null && failPrice !== null && failPrice > 0) {
        const calculatedThreshold = ((passPrice - failPrice) / failPrice) * 100;
        
        // If we found a threshold, verify it matches (within 0.1%)
        if (foundThreshold !== null) {
          const diff = Math.abs(foundThreshold - calculatedThreshold);
          if (diff > 0.1) {
            // Use the calculated one as it's more accurate
            foundThreshold = calculatedThreshold;
          }
        } else {
          // Use calculated threshold if we didn't find one in text
          foundThreshold = calculatedThreshold;
        }
      }
      
      // If we found the threshold, return it with prices
      if (foundThreshold !== null) {
        return {
          proposalPubkey: config.proposal.pubkey,
          passPrice: passPrice || 0,
          failPrice: failPrice || 0,
          passTwap: passTwap || passPrice || 0,
          failTwap: failTwap || failPrice || 0,
          threshold: foundThreshold,
          status: "active",
          timestamp: new Date(),
        };
      }
      
      // Fallback: look for any positive percentage near threshold/pass/fail keywords
      for (const match of percentages) {
        const value = parseFloat(match[1] as string);
        if (value >= -100 && value <= 100 && Math.abs(value) > 0.01 && value > 0) {
          const matchIndex = match.index as number;
          const matchLength = match[0].length;
          const context = pageText.substring(
            Math.max(0, matchIndex - 100),
            Math.min(pageText.length, matchIndex + matchLength + 100)
          ).toLowerCase();
          
          if (context.includes('threshold') || (context.includes('pass') && !context.includes('fail'))) {
            return {
              proposalPubkey: config.proposal.pubkey,
              passPrice: 0,
              failPrice: 0,
              passTwap: 0,
              failTwap: 0,
              threshold: value,
              status: "active",
              timestamp: new Date(),
            };
          }
        }
      }
      
      return null;
      
    } finally {
      try {
        if (browser) {
          await browser.close();
        }
      } catch (closeError) {
      }
    }
  } catch (error) {
    return null;
  }
}

// Fetch from webpage by scraping HTML
async function fetchFromWebpage(): Promise<ProposalData | null> {
  try {
    const url = `https://www.metadao.fi/projects/${config.proposal.projectSlug}/proposal/${config.proposal.pubkey}`;
    // Add a delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
      },
    });


    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
      } else {
      }
      
      // Try to read error body for more info
      try {
        const errorText = await response.text();
        if (errorText) {
        }
      } catch (e) {
        // Ignore error reading body
      }
      
      return null;
    }

    const html = await response.text();
    
    let threshold: number | null = null;
    let passPrice: number | null = null;
    let failPrice: number | null = null;

    // Try to find data in Next.js __NEXT_DATA__ script tag
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        
        // Navigate through Next.js data structure to find proposal data
        const findInObject = (obj: any, key: string): any => {
          if (obj && typeof obj === 'object') {
            if (key in obj) {
              return obj[key];
            }
            for (const k in obj) {
              const found = findInObject(obj[k], key);
              if (found !== undefined) return found;
            }
          }
          return undefined;
        };
        const proposalData = findInObject(nextData, 'proposal') || 
                            findInObject(nextData, 'proposalData') ||
                            findInObject(nextData, 'pageProps');
        
        if (proposalData) {
          if (typeof proposalData === 'object') {
            threshold = proposalData.threshold ?? proposalData.threshold_percent ?? null;
            passPrice = proposalData.pass_price ?? proposalData.passPrice ?? null;
            failPrice = proposalData.fail_price ?? proposalData.failPrice ?? null;
            
            console.log(`[Webpage Scraping] Initial values - threshold: ${threshold}, passPrice: ${passPrice}, failPrice: ${failPrice}`);
            
            // Also check nested structures
            if (threshold === null && proposalData.details) {
              threshold = proposalData.details.threshold ?? proposalData.details.threshold_percent ?? null;
              passPrice = proposalData.details.pass_price ?? proposalData.details.passPrice ?? passPrice;
              failPrice = proposalData.details.fail_price ?? proposalData.details.failPrice ?? failPrice;
              console.log(`[Webpage Scraping] After checking details - threshold: ${threshold}, passPrice: ${passPrice}, failPrice: ${failPrice}`);
            }
          }
        } else {
          console.log(`[Webpage Scraping] ⚠️  No proposal data found in __NEXT_DATA__`);
        }
      } catch (e) {
        console.log(`[Webpage Scraping] ❌ Failed to parse __NEXT_DATA__:`, e);
      }
    } else {
      console.log(`[Webpage Scraping] ⚠️  No __NEXT_DATA__ script tag found`);
    }

    // Try to find in other script tags with JSON data
    if (threshold === null) {
      console.log(`[Webpage Scraping] Searching other script tags for threshold...`);
      const scriptMatches = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi));
      console.log(`[Webpage Scraping] Found ${scriptMatches.length} script tags`);
      
      for (const match of scriptMatches) {
        const scriptContent = match[1];
        // Look for threshold in JSON-like structures
        const thresholdMatch = scriptContent.match(/"threshold"[^:]*:\s*([+-]?\d+\.?\d*)/i) ||
                             scriptContent.match(/threshold["\s:]+([+-]?\d+\.?\d*)/i);
        if (thresholdMatch) {
          threshold = parseFloat(thresholdMatch[1]);
          console.log(`[Webpage Scraping] ✓ Found threshold in script tag: ${threshold}%`);
          break;
        }
      }
    }

    // Try to extract prices from script tags
    if (passPrice === null) {
      const passMatch = html.match(/"pass[_-]?price"[^:]*:\s*(\d+\.?\d*)/i);
      if (passMatch) passPrice = parseFloat(passMatch[1]);
    }
    if (failPrice === null) {
      const failMatch = html.match(/"fail[_-]?price"[^:]*:\s*(\d+\.?\d*)/i);
      if (failMatch) failPrice = parseFloat(failMatch[1]);
    }

    // Look for percentage values in the visible text (like +5.5175%)
    if (threshold === null) {
      console.log(`[Webpage Scraping] Searching HTML text for percentage patterns...`);
      // Look for patterns like: +5.5175% or -2.34% that appear near threshold-related text
      const percentagePattern = /([+-]?\d+\.\d{2,})\s*%/g;
      const percentages = Array.from(html.matchAll(percentagePattern));
      console.log(`[Webpage Scraping] Found ${percentages.length} percentage patterns in HTML`);
      
      // Filter for values that look like thresholds (typically between -100% and +100%)
      for (const match of percentages) {
        const value = parseFloat(match[1]);
        if (value >= -100 && value <= 100 && Math.abs(value) > 0.01) {
          // Check if it's near threshold-related keywords
          const contextStart = Math.max(0, match.index! - 200);
          const contextEnd = Math.min(html.length, match.index! + match[0].length + 200);
          const context = html.substring(contextStart, contextEnd).toLowerCase();
          
          if (context.includes('threshold') || context.includes('pass') || context.includes('fail') || 
              context.includes('difference') || context.includes('spread')) {
            threshold = value;
            console.log(`[Webpage Scraping] ✓ Found threshold percentage in text: ${threshold}%`);
            break;
          }
        }
      }
    }

    // If we have prices but no threshold, calculate it
    if (threshold === null && passPrice !== null && failPrice !== null && failPrice > 0) {
      threshold = ((passPrice - failPrice) / failPrice) * 100;
      console.log(`[Webpage Scraping] ✓ Calculated threshold from prices: ${threshold.toFixed(4)}%`);
    }

    // If we found threshold, return the data
    if (threshold !== null) {
      console.log(`[Webpage Scraping] ✅ Successfully extracted threshold: ${threshold.toFixed(4)}%`);
      return {
        proposalPubkey: config.proposal.pubkey,
        passPrice: passPrice || 0,
        failPrice: failPrice || 0,
        passTwap: passPrice || 0,
        failTwap: failPrice || 0,
        threshold: threshold,
        status: "active",
        timestamp: new Date(),
      };
    }

    console.log(`   - HTML structure changed`);
    return null;
  } catch (error) {
    console.log(`[Webpage Scraping] ❌ Fetch failed:`, error);
    if (error instanceof Error) {
      console.log(`[Webpage Scraping] Error message: ${error.message}`);
      console.log(`[Webpage Scraping] Error stack: ${error.stack}`);
    }
    return null;
  }
}

// Fetch from market API as additional data source
async function fetchFromMarketApi(): Promise<ProposalData | null> {
  try {
    const response = await fetch(`${config.metadaoApi.baseUrl}/api/tickers`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.log(`Market API returned ${response.status}`);
      return null;
    }

    const tickers = await response.json();

    // Find Ranger token data
    const rangerTicker = tickers.find(
      (t: { base_symbol?: string }) => t.base_symbol === "RNGR"
    );

    if (rangerTicker) {
      console.log(
        `Ranger spot price: $${rangerTicker.last_price} (from market API)`
      );
      // Note: This is spot price, not proposal-specific pass/fail prices
      // This is just for context - actual threshold needs proposal market data
    }

    return null;
  } catch (error) {
    console.log("Market API fetch failed:", error);
    return null;
  }
}

export async function fetchProposalData(): Promise<ProposalData | null> {

  // Check if we're in Cloudflare Workers (Puppeteer won't work)
  const isWorkers = typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers') ||
                    typeof globalThis !== 'undefined' && (globalThis as any).caches;

  // Try GraphQL first (most reliable if available)
  let data = await fetchFromGraphQL();
  if (data) {
    return data;
  }

  // Try webpage scraping with Puppeteer (skip in Workers - not supported)
  if (!isWorkers) {
    data = await fetchFromWebpageWithPuppeteer();
    if (data) {
      return data;
    }
  }
  // Note: Puppeteer is skipped in Cloudflare Workers (not supported)

  // Try simple webpage scraping (fallback when APIs are rate-limited)
  data = await fetchFromWebpage();
  if (data) {
    return data;
  }

  // Try Solana RPC for on-chain data
  data = await fetchFromSolanaRpc();
  if (data) {
    return data;
  }

  // Get market context (even if not proposal-specific)
  await fetchFromMarketApi();

  console.log("✗ All fetch methods failed");
  return null;
}

export function formatThreshold(threshold: number): string {
  const sign = threshold >= 0 ? "+" : "";
  return `${sign}${threshold.toFixed(4)}%`;
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(6)}`;
}
