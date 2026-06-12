/**
 * Pure scoring functions for the valuation + fundamentals layer.
 * No I/O, no side effects. All thresholds live in sector-medians.ts.
 *
 * Data source: Finnhub /stock/metric + /stock/profile2 (no daily cap).
 * Cheapness: P/E and P/S vs sector medians.
 * Fundamentals: revenue growth YoY + EPS estimate revisions.
 */

import {
  getSectorMedians,
  CHEAPNESS_THRESHOLDS,
  FUNDAMENTALS_THRESHOLDS,
} from "./sector-medians";

// ── Types ────────────────────────────────────────────────────────────────────

export type MultipleTag = "cheap" | "fair" | "expensive" | "missing";
export type CheapnessLabel = "Cheap" | "Not Cheap";
export type MomentumLabel = "Stable/Improving" | "Deteriorating";
export type VerdictLabel =
  | "Undervalued"
  | "At value"
  | "Overvalued";

export interface MultipleResult {
  value: number | null;
  sectorMedian: number;
  tag: MultipleTag;
}

export interface CheapnessInput {
  sector: string | null;
  pe: number | null;
  ps: number | null;
  isUnprofitable: boolean;
}

export interface CheapnessResult {
  label: CheapnessLabel;
  score: number;
  pe: MultipleResult;
  ps: MultipleResult;
  isUnprofitable: boolean;
  missingData: string[];
}

export interface RevisionSignal {
  direction: "up" | "flat" | "down";
  available: true;
}
export interface RevisionUnavailable {
  available: false;
}
export type EstimateRevisions = RevisionSignal | RevisionUnavailable;

export interface FundamentalsInput {
  estimateRevisions: EstimateRevisions;
  /** Revenue growth year-over-year TTM, in percent (e.g. 70.68 = +70.68%) */
  revenueGrowthYoy: number | null;
  /** Gross margin TTM, in percent (e.g. 74.15 = 74.15%) — informational only */
  grossMarginTtm: number | null;
}

export interface FundamentalsResult {
  label: MomentumLabel;
  score: number;
  estimateRevisions: EstimateRevisions;
  revenueGrowthYoy: number | null;
  grossMarginTtm: number | null;
  missingData: string[];
}

export interface AnalystCounts {
  buy: number;
  hold: number;
  sell: number;
  consensus: string;
}

export interface VerdictResult {
  ticker: string;
  verdict: VerdictLabel | null;
  cheapness: CheapnessResult;
  fundamentals: FundamentalsResult;
  analysts: AnalystCounts | null;
  explanation: string;
  missingData: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tagMultiple(value: number | null, median: number): MultipleTag {
  if (value === null || !isFinite(value) || value <= 0) return "missing";
  const ratio = value / median;
  if (ratio < 1 - CHEAPNESS_THRESHOLDS.BELOW_BAND) return "cheap";
  if (ratio > 1 + CHEAPNESS_THRESHOLDS.ABOVE_BAND) return "expensive";
  return "fair";
}

function tagScore(tag: MultipleTag): number {
  if (tag === "cheap") return 1;
  if (tag === "expensive") return -1;
  return 0;
}

// ── Axis 1: Cheapness ────────────────────────────────────────────────────────

export function scoreCheapness(input: CheapnessInput): CheapnessResult {
  const medians = getSectorMedians(input.sector);
  const missingData: string[] = [];
  let score = 0;
  let scoredSignals = 0;

  // P/E — skip for unprofitable companies
  let peResult: MultipleResult;
  if (input.isUnprofitable) {
    peResult = { value: null, sectorMedian: medians.pe, tag: "missing" };
  } else {
    const peTag = tagMultiple(input.pe, medians.pe);
    peResult = { value: input.pe, sectorMedian: medians.pe, tag: peTag };
    if (peTag === "missing") {
      missingData.push("P/E");
    } else {
      score += tagScore(peTag);
      scoredSignals++;
    }
  }

  // P/S — scored for all companies (works for unprofitable too)
  const psTag = tagMultiple(input.ps, medians.ps);
  const psResult: MultipleResult = { value: input.ps, sectorMedian: medians.ps, tag: psTag };
  if (psTag === "missing") {
    missingData.push("P/S");
  } else {
    score += tagScore(psTag);
    scoredSignals++;
  }

  const label: CheapnessLabel =
    scoredSignals > 0 && score > CHEAPNESS_THRESHOLDS.CHEAPNESS_THRESHOLD
      ? "Cheap"
      : "Not Cheap";

  return {
    label,
    score,
    pe: peResult,
    ps: psResult,
    isUnprofitable: input.isUnprofitable,
    missingData,
  };
}

// ── Axis 2: Fundamental Momentum ─────────────────────────────────────────────

function revisionSignal(rev: EstimateRevisions): number {
  if (!rev.available) return 0;
  if (rev.direction === "up") return FUNDAMENTALS_THRESHOLDS.ESTIMATE_WEIGHT;
  if (rev.direction === "down") return -FUNDAMENTALS_THRESHOLDS.ESTIMATE_WEIGHT;
  return 0;
}

export function scoreFundamentals(input: FundamentalsInput): FundamentalsResult & { _noSignals?: boolean } {
  const missingData: string[] = [];
  let score = 0;
  let usableSignals = 0;

  // EPS estimate revisions (weight 2x)
  if (input.estimateRevisions.available) {
    score += revisionSignal(input.estimateRevisions);
    usableSignals++;
  } else {
    missingData.push("EPS estimate revisions");
  }

  // Revenue growth YoY (weight 1x)
  if (input.revenueGrowthYoy !== null) {
    if (input.revenueGrowthYoy > FUNDAMENTALS_THRESHOLDS.REVENUE_GROWTH_POSITIVE) {
      score += 1;
    } else if (input.revenueGrowthYoy < FUNDAMENTALS_THRESHOLDS.REVENUE_GROWTH_NEGATIVE) {
      score -= 1;
    }
    usableSignals++;
  } else {
    missingData.push("Revenue growth");
  }

  const label: MomentumLabel =
    score > FUNDAMENTALS_THRESHOLDS.MOMENTUM_THRESHOLD
      ? "Stable/Improving"
      : "Deteriorating";

  return {
    label,
    score,
    estimateRevisions: input.estimateRevisions,
    revenueGrowthYoy: input.revenueGrowthYoy,
    grossMarginTtm: input.grossMarginTtm,
    missingData,
    ...(usableSignals === 0 ? { _noSignals: true } : {}),
  };
}

// ── Verdict mapping ───────────────────────────────────────────────────────────

export function computeVerdict(
  cheapness: CheapnessResult,
  _fundamentals: FundamentalsResult & { _noSignals?: boolean }
): VerdictLabel | null {
  if (cheapness.score > 0) return "Undervalued";
  if (cheapness.score === 0) return "At value";
  return "Overvalued";
}

// ── Explanation generation ────────────────────────────────────────────────────

export function generateExplanation(
  ticker: string,
  cheapness: CheapnessResult,
  fundamentals: FundamentalsResult,
  verdict: VerdictLabel | null
): string {
  const pePct = (val: number, median: number) =>
    `${Math.abs(Math.round(Math.abs(val / median - 1) * 100))}%`;

  const sentences: string[] = [];

  // Sentence 1: primary valuation signal
  if (cheapness.pe.tag === "cheap") {
    sentences.push(
      `${ticker}'s P/E of ${cheapness.pe.value!.toFixed(1)}× is ${pePct(cheapness.pe.value!, cheapness.pe.sectorMedian)} below the sector median of ${cheapness.pe.sectorMedian}×.`
    );
  } else if (cheapness.ps.tag === "cheap") {
    sentences.push(
      `${ticker}'s P/S of ${cheapness.ps.value!.toFixed(1)}× is ${pePct(cheapness.ps.value!, cheapness.ps.sectorMedian)} below the sector median of ${cheapness.ps.sectorMedian}×.`
    );
  } else if (cheapness.pe.tag === "expensive") {
    sentences.push(
      `${ticker}'s P/E of ${cheapness.pe.value!.toFixed(1)}× is ${pePct(cheapness.pe.value!, cheapness.pe.sectorMedian)} above the sector median of ${cheapness.pe.sectorMedian}×.`
    );
  } else if (cheapness.ps.tag === "expensive") {
    sentences.push(
      `${ticker}'s P/S of ${cheapness.ps.value!.toFixed(1)}× is ${pePct(cheapness.ps.value!, cheapness.ps.sectorMedian)} above the sector median of ${cheapness.ps.sectorMedian}×.`
    );
  } else if (cheapness.isUnprofitable) {
    sentences.push(`${ticker} is unprofitable; scored on P/S vs sector median.`);
  } else {
    sentences.push(`${ticker} is trading close to sector median multiples.`);
  }

  // Sentence 2: supporting context from fundamentals
  const rev = fundamentals.revenueGrowthYoy;
  const epsDir = fundamentals.estimateRevisions.available
    ? (fundamentals.estimateRevisions as RevisionSignal).direction
    : null;

  if (verdict === "Undervalued" && rev !== null && rev > FUNDAMENTALS_THRESHOLDS.REVENUE_GROWTH_POSITIVE) {
    sentences.push(`Revenue is also growing ${rev.toFixed(1)}% YoY, suggesting the drop may be an overreaction.`);
  } else if (verdict === "Undervalued") {
    sentences.push(`The price drop has pushed it below typical sector multiples.`);
  } else if (epsDir === "down") {
    sentences.push(`EPS estimates have been revised down recently, which may explain the premium compression.`);
  } else if (rev !== null && rev < FUNDAMENTALS_THRESHOLDS.REVENUE_GROWTH_NEGATIVE) {
    sentences.push(`Revenue contracted ${Math.abs(rev).toFixed(1)}% YoY — the drop may reflect real fundamental pressure.`);
  } else if (epsDir === "up") {
    sentences.push(`EPS estimates have been revised up recently, supporting the current premium.`);
  } else {
    sentences.push(`Review the metrics below before drawing conclusions.`);
  }

  return sentences.join(" ");
}

// ── Analyst consensus ─────────────────────────────────────────────────────────

export function computeAnalystConsensus(buy: number, hold: number, sell: number): string {
  const total = buy + hold + sell;
  if (total === 0) return "No coverage";
  const buyPct = buy / total;
  const sellPct = sell / total;
  if (buyPct >= 0.6) return "Strong Buy";
  if (buyPct >= 0.4) return "Buy";
  if (sellPct >= 0.4) return "Sell";
  if (sellPct >= 0.25) return "Underperform";
  return "Hold";
}
