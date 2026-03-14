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

// Futarchy v0.6.0 ProposalState enum:
// Draft(u64) = 0 (carries staked amount, adds 8 bytes)
// Pending = 1
// Passed = 2
// Failed = 3
// Removed = 4
const PROPOSAL_STATE: Record<number, string> = {
  0: "Draft",
  1: "Pending",
  2: "Passed",
  3: "Failed",
  4: "Removed",
};

interface ParsedProposal {
  number: number;
  proposer: PublicKey;
  timestampEnqueued: bigint;
  state: number;
  dao: PublicKey;
}

// Parse proposal account to extract the DAO pubkey
// In Futarchy v0.6.0, the AMM pools are embedded in the DAO account
function parseProposalAccount(data: Buffer): ParsedProposal | null {
  try {
    if (data.length < 120) return null;

    let o = 8; // skip discriminator

    const number = data.readUInt32LE(o); o += 4;
    const proposer = new PublicKey(data.subarray(o, o + 32)); o += 32;
    const timestampEnqueued = data.readBigInt64LE(o); o += 8;

    // ProposalState enum: variant 0 (Draft) carries a u64
    const stateVariant = data.readUInt8(o); o += 1;
    if (stateVariant === 0) {
      o += 8; // skip Draft's u64 staked amount
    }

    // baseVault (32) + quoteVault (32)
    o += 64;

    // dao pubkey
    const dao = new PublicKey(data.subarray(o, o + 32));

    return { number, proposer, timestampEnqueued, state: stateVariant, dao };
  } catch {
    return null;
  }
}

interface PoolData {
  quoteReserves: number;
  baseReserves: number;
  price: number;
  // TWAP oracle fields
  lastObservation: bigint;
}

// Parse a Pool struct from the DAO account
// Pool = TwapOracle(100 bytes) + quote_reserves(8) + base_reserves(8) + quote_fee(8) + base_fee(8) = 132 bytes
function readPool(data: Buffer, offset: number): PoolData {
  // TwapOracle: aggregator(u128=16) + last_updated_timestamp(i64=8) + last_price(u128=16)
  //           + last_observation(u128=16) + max_observation_change(u128=16) + initial_observation(u128=16)
  //           + start_delay_seconds(u32=4) + created_at_timestamp(i64=8) = 100 bytes

  // Read last_observation (at offset + 16 + 8 + 16 = 40 within TwapOracle)
  const obsLo = data.readBigUInt64LE(offset + 40);
  const obsHi = data.readBigUInt64LE(offset + 48);
  const lastObservation = obsLo + (obsHi << 64n);

  const poolDataOffset = offset + 100; // after TwapOracle
  const quoteReserves = Number(data.readBigUInt64LE(poolDataOffset));
  const baseReserves = Number(data.readBigUInt64LE(poolDataOffset + 8));
  const price = baseReserves > 0 ? quoteReserves / baseReserves : 0;

  return { quoteReserves, baseReserves, price, lastObservation };
}

const POOL_SIZE = 132;

async function fetchFromSolanaRpc(): Promise<ProposalData | null> {
  try {
    console.log(`[Solana RPC] Fetching proposal: ${config.proposal.pubkey}`);
    const connection = new Connection(config.solana.rpcUrl, "confirmed");
    const proposalPubkey = new PublicKey(config.proposal.pubkey);

    const accountInfo = await connection.getAccountInfo(proposalPubkey);
    if (!accountInfo) {
      console.log("[Solana RPC] ❌ Proposal account not found");
      return null;
    }

    const proposal = parseProposalAccount(accountInfo.data);
    if (!proposal) {
      console.log("[Solana RPC] ❌ Failed to parse proposal account");
      return null;
    }

    const stateStr = PROPOSAL_STATE[proposal.state] || "Unknown";
    console.log(`[Solana RPC] ✓ Proposal #${proposal.number}, state: ${stateStr}`);
    console.log(`[Solana RPC]   dao: ${proposal.dao.toBase58()}`);

    // Fetch the DAO account (contains the embedded FutarchyAmm with pass/fail pools)
    const daoInfo = await connection.getAccountInfo(proposal.dao);
    if (!daoInfo) {
      console.log("[Solana RPC] ❌ DAO account not found");
      return null;
    }
    console.log(`[Solana RPC] ✓ DAO account found, ${daoInfo.data.length} bytes`);

    // DAO account layout:
    // 8 bytes discriminator
    // FutarchyAmm: { state: PoolState(1 byte variant + pools), total_liquidity(u128=16), base_mint(32), ... }
    // PoolState::Futarchy(1) = { spot: Pool(132), pass: Pool(132), fail: Pool(132) }

    let o = 8; // skip discriminator
    const poolStateVariant = daoInfo.data.readUInt8(o); o += 1;

    if (poolStateVariant !== 1) {
      console.log(`[Solana RPC] ❌ PoolState is ${poolStateVariant} (Spot), not Futarchy — no pass/fail pools`);
      return null;
    }

    // Read spot, pass, fail pools
    const spotPool = readPool(daoInfo.data, o); o += POOL_SIZE;
    const passPool = readPool(daoInfo.data, o); o += POOL_SIZE;
    const failPool = readPool(daoInfo.data, o);

    console.log(`[Solana RPC] ✓ Spot price: $${spotPool.price.toFixed(6)}`);
    console.log(`[Solana RPC] ✓ Pass price: $${passPool.price.toFixed(6)} (reserves: ${passPool.quoteReserves}/${passPool.baseReserves})`);
    console.log(`[Solana RPC] ✓ Fail price: $${failPool.price.toFixed(6)} (reserves: ${failPool.quoteReserves}/${failPool.baseReserves})`);

    if (passPool.price <= 0 || failPool.price <= 0) {
      console.log("[Solana RPC] ❌ Invalid prices (zero or negative)");
      return null;
    }

    const threshold = ((passPool.price - failPool.price) / failPool.price) * 100;
    console.log(`[Solana RPC] ✅ Threshold: ${threshold.toFixed(4)}%`);

    return {
      proposalPubkey: config.proposal.pubkey,
      passPrice: passPool.price,
      failPrice: failPool.price,
      passTwap: passPool.price, // Using spot as approximation
      failTwap: failPool.price,
      threshold,
      status: stateStr.toLowerCase(),
      timestamp: new Date(),
    };
  } catch (error) {
    console.log("[Solana RPC] ❌ Error:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function fetchProposalData(): Promise<ProposalData | null> {
  console.log("\n--- Fetching proposal data ---");
  const data = await fetchFromSolanaRpc();
  if (data) return data;

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
