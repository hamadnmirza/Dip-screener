import { fetchTickerNews } from "./finnhub";
import {
  fetchBenchmarkReturn,
  getBenchmarkTicker,
  EXCESS_MOVE_COMPANY_THRESHOLD,
  EXCESS_MOVE_OUTPERFORMER_THRESHOLD,
} from "./benchmark";
import { logger } from "./logger";
import type { TimePeriod, Market } from "./polygon";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MoveType =
  | "company_specific"
  | "market_driven"
  | "relative_outperformer"
  | "insufficient_data";

export type DropCauseCategory =
  | "sector_macro"
  | "technical_no_news"
  | "operational_stumble"
  | "thesis_impairment"
  | "secular_decline"
  | "solvency_stress"
  | "governance_accounting"
  | "corporate_action"
  | "unknown";

export type CauseSignal = "green" | "amber" | "red" | "neutral";

export interface DropCause {
  dominant: DropCauseCategory;
  secondary: DropCauseCategory[];
  signal: CauseSignal;
}

export interface DropEvidence {
  headline: string;
  source: string;
  url: string;
  published: string;
}

export interface DropClassification {
  ticker: string;
  asOf: string;
  period: TimePeriod;
  stockReturn: number | null;
  sectorBenchmark: string;
  sectorReturn: number | null;
  excessMove: number | null;
  moveType: MoveType;
  cause: DropCause;
  confidence: "high" | "medium" | "low";
  evidenceAvailable: boolean;
  evidence: DropEvidence[];
  rationale: string;
  disclaimer: string;
}

export interface ClassifyDropInput {
  ticker: string;
  period: TimePeriod;
  stockReturn: number | null;
  finnhubSector: string | null;
  market: Market | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCLAIMER = "Decision-support signal, not investment advice.";

const CAUSE_SIGNAL_MAP: Record<DropCauseCategory, CauseSignal> = {
  sector_macro:          "green",
  technical_no_news:     "amber",
  operational_stumble:   "amber",
  thesis_impairment:     "red",
  secular_decline:       "red",
  solvency_stress:       "red",
  governance_accounting: "red",
  corporate_action:      "neutral",
  unknown:               "amber",
};

// Ordered from highest to lowest priority (checked first = wins ties)
const CAUSE_PRIORITY: DropCauseCategory[] = [
  "governance_accounting",
  "solvency_stress",
  "secular_decline",
  "thesis_impairment",
  "corporate_action",
  "operational_stumble",
  "sector_macro",
];

// Keyword sets — matched against lowercased headlines
const CAUSE_KEYWORDS: Partial<Record<DropCauseCategory, string[]>> = {
  governance_accounting: [
    "restat", "fraud", "investigation", "sec charge", "securities violation",
    "insider trading", "accounting irregularit", "cfo resign", "auditor change",
    "whistleblower", "embezzl", "manipulation", "class action lawsuit",
  ],
  solvency_stress: [
    "bankrupt", "chapter 11", "default", "covenant breach", "refinanc",
    "credit downgrade", "rating cut", "going concern", "debt restructur",
    "liquidity concern", "solvency", "dilutive offering", "distressed",
  ],
  secular_decline: [
    "structural decline", "shrinking market", "end market declining",
    "secular headwind", "industry contraction", "structural shift away",
    "long-term decline", "legacy business",
  ],
  thesis_impairment: [
    "market share loss", "losing market share", "pricing power",
    "competitive threat", "major disruption", "patent cliff", "patent expir",
    "permanent headwind", "obsolet", "moat erosion", "business model threat",
    "competitive pressure intensi",
  ],
  corporate_action: [
    "acqui", "merger", "spin-off", "spinoff", "divestiture", "going private",
    "tender offer", "reverse stock split", "buyback program", "dividend cut",
    "dividend suspend", "dividend eliminat", "special dividend",
  ],
  operational_stumble: [
    "earnings miss", "revenue miss", "missed estimate", "guidance cut",
    "lowered guidance", "below expect", "below consensus", "downgrade",
    "one-time charge", "write-down", "impairment", "restructuring",
    "layoff", "job cut", "headcount reduction", "ceo depart", "ceo resign",
    "management shake", "profit warning", "shortfall", "disappointing result",
    "missed quarterly",
  ],
  sector_macro: [
    "sector selloff", "broad market decline", "macro headwind",
    "rate hike", "federal reserve", "inflation data", "tariff",
    "trade war", "geopolitical", "sector-wide", "industry-wide selloff",
    "market rout", "risk-off", "yield spike",
  ],
};

// ── Classification logic ───────────────────────────────────────────────────────

function deriveMoveType(
  stockReturn: number | null,
  sectorReturn: number | null
): { moveType: MoveType; excessMove: number | null } {
  if (stockReturn === null || sectorReturn === null) {
    return { moveType: "insufficient_data", excessMove: null };
  }
  const excessMove = stockReturn - sectorReturn;
  let moveType: MoveType;
  if (excessMove <= EXCESS_MOVE_COMPANY_THRESHOLD) {
    moveType = "company_specific";
  } else if (excessMove >= EXCESS_MOVE_OUTPERFORMER_THRESHOLD) {
    moveType = "relative_outperformer";
  } else {
    moveType = "market_driven";
  }
  return { moveType, excessMove };
}

function scoreHeadlineForCause(headline: string, cause: DropCauseCategory): number {
  const lower = headline.toLowerCase();
  const keywords = CAUSE_KEYWORDS[cause] ?? [];
  return keywords.filter((kw) => lower.includes(kw)).length;
}

function classifyFromNewsAndMoveType(
  headlines: string[],
  moveType: MoveType
): { dominant: DropCauseCategory; secondary: DropCauseCategory[]; keywordsMatched: boolean } {
  if (headlines.length === 0) {
    // No news — use move type to decide
    const dominant =
      moveType === "market_driven" || moveType === "relative_outperformer"
        ? "sector_macro"
        : "technical_no_news";
    return { dominant, secondary: [], keywordsMatched: false };
  }

  const scores: [DropCauseCategory, number][] = CAUSE_PRIORITY
    .map((cause): [DropCauseCategory, number] => {
      const total = headlines.reduce((sum, h) => sum + scoreHeadlineForCause(h, cause), 0);
      return [cause, total];
    })
    .filter(([, score]) => score > 0);

  scores.sort((a, b) => b[1] - a[1]);

  if (scores.length === 0) {
    // News exists but no keyword matches
    const dominant =
      moveType === "market_driven" || moveType === "relative_outperformer"
        ? "sector_macro"
        : "technical_no_news";
    return { dominant, secondary: [], keywordsMatched: false };
  }

  const dominant = scores[0][0];
  const secondary = scores.slice(1, 3).map(([c]) => c);
  return { dominant, secondary, keywordsMatched: true };
}

function deriveConfidence(
  hasSectorReturn: boolean,
  hasNews: boolean,
  keywordsMatched: boolean
): "high" | "medium" | "low" {
  if (hasSectorReturn && hasNews && keywordsMatched) return "high";
  if (hasSectorReturn || (hasNews && keywordsMatched)) return "medium";
  return "low";
}

function buildRationale(
  ticker: string,
  period: TimePeriod,
  stockReturn: number | null,
  sectorReturn: number | null,
  excessMove: number | null,
  moveType: MoveType,
  dominant: DropCauseCategory,
  sectorBenchmark: string,
  hasNews: boolean
): string {
  const pctFmt = (v: number | null) =>
    v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "N/A";

  const causeLabels: Record<DropCauseCategory, string> = {
    sector_macro:          "broad market/sector weakness",
    technical_no_news:     "no identifiable news catalyst (possible technical/flow move)",
    operational_stumble:   "a near-term operational setback",
    thesis_impairment:     "a structural threat to the investment case",
    secular_decline:       "a structural end-market headwind",
    solvency_stress:       "financial stress / balance-sheet concern",
    governance_accounting: "a governance or accounting concern",
    corporate_action:      "a corporate action or structural change",
    unknown:               "unclear cause",
  };

  const periodLabels: Record<TimePeriod, string> = {
    "1h": "intraday", "24h": "over 24h", "1w": "over the past week", "1m": "over the past month",
  };

  const parts: string[] = [];

  if (excessMove != null && sectorReturn != null) {
    if (moveType === "company_specific") {
      parts.push(
        `${ticker} fell ${pctFmt(excessMove)} more than ${sectorBenchmark} ${periodLabels[period]}`
      );
    } else if (moveType === "relative_outperformer") {
      parts.push(
        `${ticker} outperformed ${sectorBenchmark} by ${pctFmt(Math.abs(excessMove))} ${periodLabels[period]} despite falling`
      );
    } else {
      parts.push(
        `${ticker} moved broadly in line with ${sectorBenchmark} (${pctFmt(sectorReturn)} sector, ${pctFmt(stockReturn)} stock) ${periodLabels[period]}`
      );
    }
  } else if (stockReturn != null) {
    parts.push(
      `${ticker} dropped ${pctFmt(stockReturn)} ${periodLabels[period]}; sector benchmark unavailable`
    );
  } else {
    parts.push(`${ticker} classification based on news only — price data unavailable`);
  }

  if (hasNews) {
    parts.push(`news coverage points to ${causeLabels[dominant]}`);
  } else {
    parts.push(`no recent news found — classified on price action only`);
  }

  return parts.join("; ").replace(/^./, (c) => c.toUpperCase()) + ".";
}

// ── Public API ─────────────────────────────────────────────────────────────────

const classifyCache = new Map<string, { data: DropClassification; expiresAt: number }>();
const CLASSIFY_CACHE_TTL_MS = 15 * 60 * 1000;

export async function classifyDrop(input: ClassifyDropInput): Promise<DropClassification> {
  const { ticker, period, stockReturn, finnhubSector, market } = input;
  const cacheKey = `classify:${ticker}:${period}`;
  const cached = classifyCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  logger.debug({ ticker, period }, "classifyDrop called");

  const etfTicker = getBenchmarkTicker(finnhubSector, market);

  // Run benchmark fetch + news fetch in parallel
  const [benchmark, newsArticles] = await Promise.all([
    fetchBenchmarkReturn(etfTicker, period),
    fetchTickerNews(ticker).catch(() => []),
  ]);

  const sectorReturn = benchmark.percentChange;
  const { moveType, excessMove } = deriveMoveType(stockReturn, sectorReturn);

  const headlines = newsArticles.map((a) => a.headline);
  const hasNews = headlines.length > 0;

  const { dominant, secondary, keywordsMatched } = classifyFromNewsAndMoveType(
    headlines,
    moveType
  );

  const confidence = deriveConfidence(sectorReturn !== null, hasNews, keywordsMatched);

  const evidence: DropEvidence[] = newsArticles.map((a) => ({
    headline: a.headline,
    source: a.source,
    url: a.url,
    published: a.publishedAt,
  }));

  const rationale = buildRationale(
    ticker, period, stockReturn, sectorReturn,
    excessMove, moveType, dominant, etfTicker, hasNews
  );

  const result: DropClassification = {
    ticker,
    asOf: new Date().toISOString(),
    period,
    stockReturn: stockReturn ?? null,
    sectorBenchmark: etfTicker,
    sectorReturn,
    excessMove,
    moveType,
    cause: {
      dominant,
      secondary,
      signal: CAUSE_SIGNAL_MAP[dominant],
    },
    confidence,
    evidenceAvailable: hasNews,
    evidence,
    rationale,
    disclaimer: DISCLAIMER,
  };

  classifyCache.set(cacheKey, { data: result, expiresAt: Date.now() + CLASSIFY_CACHE_TTL_MS });
  return result;
}
