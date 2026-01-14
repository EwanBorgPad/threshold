import { ProposalData } from "./metadao.js";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "threshold_history.json");

interface HistoryEntry {
  timestamp: string;
  threshold: number;
  passPrice: number;
  failPrice: number;
}

interface ThresholdHistory {
  proposalPubkey: string;
  entries: HistoryEntry[];
}

export interface ThresholdReport {
  current: number;
  previousHour: number | null;
  variation: number | null;
  variationPercent: number | null;
  passPrice: number;
  failPrice: number;
  timestamp: Date;
  status: string;
  isFinalized: boolean;
}

function loadHistory(): ThresholdHistory | null {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(data) as ThresholdHistory;
    }
  } catch (error) {
    console.error("Error loading history:", error);
  }
  return null;
}

function saveHistory(history: ThresholdHistory): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error("Error saving history:", error);
  }
}

export function recordThreshold(data: ProposalData): void {
  let history = loadHistory();

  if (!history || history.proposalPubkey !== data.proposalPubkey) {
    history = {
      proposalPubkey: data.proposalPubkey,
      entries: [],
    };
  }

  const entry: HistoryEntry = {
    timestamp: data.timestamp.toISOString(),
    threshold: data.threshold,
    passPrice: data.passPrice,
    failPrice: data.failPrice,
  };

  history.entries.push(entry);

  // Keep only last 168 entries (7 days of hourly data)
  if (history.entries.length > 168) {
    history.entries = history.entries.slice(-168);
  }

  saveHistory(history);
}

export function getThresholdReport(data: ProposalData): ThresholdReport {
  const history = loadHistory();
  const oneHourAgo = new Date(data.timestamp.getTime() - 60 * 60 * 1000);

  let previousHour: number | null = null;
  let variation: number | null = null;
  let variationPercent: number | null = null;

  // Determine if proposal is finalized
  const finalizedStatuses = ["passed", "failed", "executed"];
  const isFinalized = finalizedStatuses.includes(data.status.toLowerCase());

  if (history && history.proposalPubkey === data.proposalPubkey) {
    // Find the closest entry to one hour ago
    let closestEntry: HistoryEntry | null = null;
    let closestDiff = Infinity;

    for (const entry of history.entries) {
      const entryTime = new Date(entry.timestamp);
      const diff = Math.abs(entryTime.getTime() - oneHourAgo.getTime());

      // Within 10 minutes of the hour mark
      if (diff < closestDiff && diff < 10 * 60 * 1000) {
        closestDiff = diff;
        closestEntry = entry;
      }
    }

    if (closestEntry) {
      previousHour = closestEntry.threshold;
      variation = data.threshold - previousHour;
      variationPercent =
        previousHour !== 0 ? (variation / Math.abs(previousHour)) * 100 : null;
    }
  }

  return {
    current: data.threshold,
    previousHour,
    variation,
    variationPercent,
    passPrice: data.passPrice,
    failPrice: data.failPrice,
    timestamp: data.timestamp,
    status: data.status,
    isFinalized,
  };
}

export function formatReport(report: ThresholdReport): string {
  const lines: string[] = [];

  lines.push("📊 *MetaDAO Proposal Threshold Update*");
  lines.push("");

  // Handle finalized proposals
  if (report.isFinalized) {
    const statusEmoji =
      report.status.toLowerCase() === "passed" ? "✅" :
      report.status.toLowerCase() === "failed" ? "❌" : "📋";

    lines.push(`${statusEmoji} *Proposal Status:* ${report.status.toUpperCase()}`);
    lines.push("");
    lines.push("_This proposal has been finalized._");
    lines.push("_Markets are closed - live threshold data unavailable._");
    lines.push("");
    lines.push(`_Last checked: ${report.timestamp.toUTCString()}_`);

    return lines.join("\n");
  }

  // Active proposal - show threshold data
  const thresholdSign = report.current >= 0 ? "+" : "";
  lines.push(
    `*Current Threshold:* ${thresholdSign}${report.current.toFixed(4)}%`
  );

  // Pass/Fail prices
  lines.push(`*Pass Price:* $${report.passPrice.toFixed(6)}`);
  lines.push(`*Fail Price:* $${report.failPrice.toFixed(6)}`);
  
  // Calculate and display price difference percentage
  if (report.passPrice > 0 && report.failPrice > 0) {
    const priceDiffPercent = ((report.passPrice - report.failPrice) / report.failPrice) * 100;
    const priceDiffSign = priceDiffPercent >= 0 ? "+" : "";
    lines.push(`*Price Difference:* ${priceDiffSign}${priceDiffPercent.toFixed(4)}%`);
  }

  lines.push("");

  // Variation from last hour
  if (report.variation !== null && report.previousHour !== null) {
    const variationSign = report.variation >= 0 ? "+" : "";
    const arrow = report.variation > 0 ? "📈" : report.variation < 0 ? "📉" : "➡️";

    lines.push(`*1-Hour Change:*`);
    lines.push(
      `${arrow} ${variationSign}${report.variation.toFixed(4)} percentage points`
    );

    if (report.variationPercent !== null) {
      const vpSign = report.variationPercent >= 0 ? "+" : "";
      lines.push(`   (${vpSign}${report.variationPercent.toFixed(2)}% relative change)`);
    }

    lines.push(
      `   Previous: ${report.previousHour >= 0 ? "+" : ""}${report.previousHour.toFixed(4)}%`
    );
  } else {
    lines.push("_No previous data available for comparison_");
  }

  lines.push("");

  // Status indicator for active proposals
  if (report.current > 3) {
    lines.push("✅ *Status:* Currently PASSING (above 3% threshold)");
  } else if (report.current > 0) {
    lines.push("⚠️ *Status:* Positive but below pass threshold");
  } else {
    lines.push("❌ *Status:* Currently FAILING (negative threshold)");
  }

  lines.push("");
  lines.push(`_Updated: ${report.timestamp.toUTCString()}_`);

  return lines.join("\n");
}
