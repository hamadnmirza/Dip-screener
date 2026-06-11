/**
 * Pure scoring functions for the valuation + fundamentals layer.
 * No I/O, no side effects. All thresholds live in sector-medians.ts.
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
  | "Potential Bargain"
  | "Falling Knife"
  | "Repricing"
  | "Avoid"
  | "Cheap — Unverified"
  | "Not Cheap — Unverified";

export interface MultipleResult {
  value: number | null;
  sectorMedian: number;
  tag: MultipleTag;
}

export interface CheapnessInput {
  sector: string | null;
  pe: number | null;
  evEbitda: number | null;
  pFcf: number | null;
  peg: number | null;
  evRevenue: number | null;
  isUnprofitable: boolean;
}

export interface CheapnessResult {
  label: CheapnessLabel;
  score: number;
  pe: MultipleResult;
  evEbitda: MultipleResult;
  pFcf: MultipleResult;
  peg: MultipleResult | null;
  evRevenue: MultipleResult | null;
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

export interface RevenueTrend {
  direction: "growing" | "decelerating" | "shrinking" | "unknown";
  quarters: number[]; // revenue values oldest→newest
}

export interface MarginTrend {
  direction: "stable" | "expanding" | "compressing" | "unknown";
  quarters: number[]; // gross margin % oldest→newest
}

export interface DebtGate {
  triggered: boolean;
  debtToEbitda: number | null;
  fcfTtm: number | null;
}

export interface FundamentalsInput {
  estimateRevisions: EstimateRevisions;
  quarterlyRevenue: number[]; // at least 4 values, oldest→newest
  quarterlyGrossMargin: number[]; // gross margin % oldest→newest
  debtToEbitda: number | null;
  fcfTtm: number | null;
}

export interface FundamentalsResult {
  label: MomentumLabel;
  score: number;
  estimateRevisions: EstimateRevisions;
  revenueTrend: RevenueTrend;
  marginTrend: MarginTrend;
  debtGate: DebtGate;
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

function tagMultiple(
  value: number | null,
  median: number,
  lowerIsBetter = true
): MultipleTag {
  if (value === null || !isFinite(value) || value <= 0) return "missing";
  const ratio = value / median;
  if (lowerIsBetter) {
    if (ratio < 1 - CHEAPNESS_THRESHOLDS.BELOW_BAND) return "cheap";
    if (ratio > 1 + CHEAPNESS_THRESHOLDS.ABOVE_BAND) return "expensive";
    return "fair";
  } else {
    // higher-is-better metric
    if (ratio > 1 + CHEAPNESS_THRESHOLDS.ABOVE_BAND) return "cheap";
    if (ratio < 1 - CHEAPNESS_THRESHOLDS.BELOW_BAND) return "expensive";
    return "fair";
  }
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

  // P/E — skip for unprofitable companies
  let peResult: MultipleResult;
  if (input.isUnprofitable) {
    peResult = { value: null, sectorMedian: medians.pe, tag: "missing" };
    // don't count PE for unprofitable
  } else {
    const peTag = tagMultiple(input.pe, medians.pe);
    peResult = { value: input.pe, sectorMedian: medians.pe, tag: peTag };
    if (peTag === "missing") missingData.push("P/E");
    else score += tagScore(peTag);
  }

  // EV/EBITDA — skip for unprofitable
  let evEbitdaResult: MultipleResult;
  if (input.isUnprofitable) {
    evEbitdaResult = { value: null, sectorMedian: medians.evEbitda, tag: "missing" };
  } else {
    const evTag = tagMultiple(input.evEbitda, medians.evEbitda);
    evEbitdaResult = { value: input.evEbitda, sectorMedian: medians.evEbitda, tag: evTag };
    if (evTag === "missing") missingData.push("EV/EBITDA");
    else score += tagScore(evTag);
  }

  // P/FCF — skip for unprofitable
  let pFcfResult: MultipleResult;
  if (input.isUnprofitable) {
    pFcfResult = { value: null, sectorMedian: medians.pFcf, tag: "missing" };
  } else {
    const fcfTag = tagMultiple(input.pFcf, medians.pFcf);
    pFcfResult = { value: input.pFcf, sectorMedian: medians.pFcf, tag: fcfTag };
    if (fcfTag === "missing") missingData.push("P/FCF");
    else score += tagScore(fcfTag);
  }

  // PEG overlay (lower is better)
  let pegResult: MultipleResult | null = null;
  if (!input.isUnprofitable && input.peg !== null && input.peg !== undefined) {
    if (input.peg > 0 && isFinite(input.peg)) {
      const pegTag: MultipleTag =
        input.peg < CHEAPNESS_THRESHOLDS.PEG_CHEAP
          ? "cheap"
          : input.peg > CHEAPNESS_THRESHOLDS.PEG_EXPENSIVE
          ? "expensive"
          : "fair";
      pegResult = { value: input.peg, sectorMedian: CHEAPNESS_THRESHOLDS.PEG_CHEAP, tag: pegTag };
      score += tagScore(pegTag);
    }
    // negative or zero PEG = skip
  }

  // EV/Revenue fallback for unprofitable companies
  let evRevenueResult: MultipleResult | null = null;
  if (input.isUnprofitable) {
    const evRevTag = tagMultiple(input.evRevenue, medians.evRevenue);
    evRevenueResult = { value: input.evRevenue, sectorMedian: medians.evRevenue, tag: evRevTag };
    if (evRevTag === "missing") missingData.push("EV/Revenue");
    else score += tagScore(evRevTag);
  }

  const label: CheapnessLabel = score > CHEAPNESS_THRESHOLDS.CHEAPNESS_THRESHOLD ? "Cheap" : "Not Cheap";

  return {
    label,
    score,
    pe: peResult,
    evEbitda: evEbitdaResult,
    pFcf: pFcfResult,
    peg: pegResult,
    evRevenue: evRevenueResult,
    isUnprofitable: input.isUnprofitable,
    missingData,
  };
}

// ── Axis 2: Fundamental Momentum ─────────────────────────────────────────────

function computeRevenueTrend(quarters: number[]): RevenueTrend {
  const q = quarters.filter((v) => v > 0);
  if (q.length < 3) return { direction: "unknown", quarters: q };

  const recent = q.slice(-4); // last 4
  // QoQ growth rates
  const rates: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    rates.push((recent[i] - recent[i - 1]) / recent[i - 1]);
  }

  // Shrinking: most recent quarter lower than oldest in the window
  const overallGrowth = (recent[recent.length - 1] - recent[0]) / recent[0];
  if (overallGrowth < -0.02) {
    return { direction: "shrinking", quarters: recent };
  }

  // Decelerating two consecutive: growth rate declining for 2+ consecutive periods
  let deceleratingCount = 0;
  for (let i = 1; i < rates.length; i++) {
    if (rates[i] < rates[i - 1]) deceleratingCount++;
    else deceleratingCount = 0;
    if (deceleratingCount >= 2) {
      return { direction: "decelerating", quarters: recent };
    }
  }

  return { direction: "growing", quarters: recent };
}

function computeMarginTrend(margins: number[]): MarginTrend {
  const m = margins.filter((v) => isFinite(v));
  if (m.length < 3) return { direction: "unknown", quarters: m };

  const recent = m.slice(-4);

  // Compressing two consecutive: margin declining for 2 consecutive periods
  let compressingCount = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] < recent[i - 1] - 0.005) {
      // 0.5% tolerance
      compressingCount++;
    } else {
      compressingCount = 0;
    }
    if (compressingCount >= 2) {
      return { direction: "compressing", quarters: recent };
    }
  }

  // Expanding: latest margin > earliest by >1%
  if (recent[recent.length - 1] > recent[0] + 0.01) {
    return { direction: "expanding", quarters: recent };
  }

  return { direction: "stable", quarters: recent };
}

function revisionSignal(rev: EstimateRevisions): number {
  if (!rev.available) return 0;
  if (rev.direction === "up") return FUNDAMENTALS_THRESHOLDS.ESTIMATE_WEIGHT;
  if (rev.direction === "down") return -FUNDAMENTALS_THRESHOLDS.ESTIMATE_WEIGHT;
  return 0;
}

export function scoreFundamentals(input: FundamentalsInput): FundamentalsResult {
  const missingData: string[] = [];

  // Balance-sheet gate: debt/EBITDA > 3 AND negative FCF
  const debtGate: DebtGate = {
    triggered: false,
    debtToEbitda: input.debtToEbitda,
    fcfTtm: input.fcfTtm,
  };
  const highDebt =
    input.debtToEbitda !== null &&
    isFinite(input.debtToEbitda) &&
    input.debtToEbitda > FUNDAMENTALS_THRESHOLDS.DEBT_EBITDA_GATE;
  const negativeFcf =
    input.fcfTtm !== null &&
    input.fcfTtm < FUNDAMENTALS_THRESHOLDS.FCF_NEGATIVE;
  if (highDebt && negativeFcf) {
    debtGate.triggered = true;
  }

  const revenueTrend = computeRevenueTrend(input.quarterlyRevenue);
  const marginTrend = computeMarginTrend(input.quarterlyGrossMargin);

  if (revenueTrend.direction === "unknown") missingData.push("Revenue history");
  if (marginTrend.direction === "unknown") missingData.push("Margin history");
  if (!input.estimateRevisions.available) missingData.push("EPS estimate revisions");

  // Automatic gate overrides everything
  if (debtGate.triggered) {
    return {
      label: "Deteriorating",
      score: -10,
      estimateRevisions: input.estimateRevisions,
      revenueTrend,
      marginTrend,
      debtGate,
      missingData,
    };
  }

  // Weighted sum
  let score = 0;
  let usableSignals = 0;

  if (input.estimateRevisions.available) {
    score += revisionSignal(input.estimateRevisions);
    usableSignals++;
  }

  if (revenueTrend.direction !== "unknown") {
    if (revenueTrend.direction === "growing") score += 1;
    else if (revenueTrend.direction === "shrinking" || revenueTrend.direction === "decelerating") score -= 1;
    usableSignals++;
  }

  if (marginTrend.direction !== "unknown") {
    if (marginTrend.direction === "stable" || marginTrend.direction === "expanding") score += 1;
    else if (marginTrend.direction === "compressing") score -= 1;
    usableSignals++;
  }

  const label: MomentumLabel =
    score > FUNDAMENTALS_THRESHOLDS.MOMENTUM_THRESHOLD ? "Stable/Improving" : "Deteriorating";

  return {
    label,
    score,
    estimateRevisions: input.estimateRevisions,
    revenueTrend,
    marginTrend,
    debtGate,
    missingData,
    // attach usable signal count for caller to use for unverified check
    ...(usableSignals === 0 ? { _noSignals: true } : {}),
  } as FundamentalsResult & { _noSignals?: boolean };
}

// ── Verdict mapping ───────────────────────────────────────────────────────────

export function computeVerdict(
  cheapness: CheapnessResult,
  fundamentals: FundamentalsResult & { _noSignals?: boolean }
): VerdictLabel | null {
  const noSignals = (fundamentals as FundamentalsResult & { _noSignals?: boolean })._noSignals;

  if (noSignals) {
    return cheapness.label === "Cheap" ? "Cheap — Unverified" : "Not Cheap — Unverified";
  }

  if (cheapness.label === "Cheap" && fundamentals.label === "Stable/Improving") return "Potential Bargain";
  if (cheapness.label === "Cheap" && fundamentals.label === "Deteriorating") return "Falling Knife";
  if (cheapness.label === "Not Cheap" && fundamentals.label === "Stable/Improving") return "Repricing";
  return "Avoid";
}

// ── Explanation generation ────────────────────────────────────────────────────

function pct(val: number): string {
  return `${Math.abs(Math.round(val * 100))}%`;
}

export function generateExplanation(
  ticker: string,
  cheapness: CheapnessResult,
  fundamentals: FundamentalsResult,
  verdict: VerdictLabel | null
): string {
  const sentences: string[] = [];

  // Sentence 1: most decisive cheapness signal
  const cheapSignals = [
    cheapness.pe.tag === "cheap" ? `P/E is ${pct(1 - cheapness.pe.value! / cheapness.pe.sectorMedian)} below sector median` : null,
    cheapness.evEbitda.tag === "cheap" ? `EV/EBITDA is ${pct(1 - cheapness.evEbitda.value! / cheapness.evEbitda.sectorMedian)} below sector median` : null,
    cheapness.pFcf.tag === "cheap" ? `P/FCF is ${pct(1 - cheapness.pFcf.value! / cheapness.pFcf.sectorMedian)} below sector median` : null,
    cheapness.evRevenue?.tag === "cheap" ? `EV/Revenue is ${pct(1 - cheapness.evRevenue.value! / cheapness.evRevenue.sectorMedian)} below sector median` : null,
  ].filter(Boolean);

  const expensiveSignals = [
    cheapness.pe.tag === "expensive" ? `P/E trades ${pct(cheapness.pe.value! / cheapness.pe.sectorMedian - 1)} above sector median` : null,
    cheapness.evEbitda.tag === "expensive" ? `EV/EBITDA trades ${pct(cheapness.evEbitda.value! / cheapness.evEbitda.sectorMedian - 1)} above sector median` : null,
  ].filter(Boolean);

  if (cheapSignals.length > 0) {
    sentences.push(`${ticker} looks cheap: ${cheapSignals[0]}.`);
  } else if (expensiveSignals.length > 0) {
    sentences.push(`${ticker} still trades at a premium: ${expensiveSignals[0]}.`);
  } else if (cheapness.isUnprofitable) {
    sentences.push(`${ticker} is unprofitable; valuation scored on EV/Revenue vs sector median.`);
  } else {
    sentences.push(`${ticker} is trading near sector median multiples.`);
  }

  // Sentence 2: decisive fundamentals signal or interpretation
  if (fundamentals.debtGate.triggered) {
    const d = fundamentals.debtGate.debtToEbitda?.toFixed(1) ?? "high";
    sentences.push(`However, debt/EBITDA of ${d}× combined with negative free cash flow triggers the balance-sheet gate — the cheapness may reflect financial stress, not opportunity.`);
  } else if (!fundamentals.estimateRevisions.available && fundamentals.revenueTrend.direction === "shrinking") {
    sentences.push(`Revenue is contracting and estimate revision data is unavailable; the fundamental picture is uncertain.`);
  } else if (fundamentals.estimateRevisions.available && (fundamentals.estimateRevisions as RevisionSignal).direction === "down") {
    sentences.push(`Analyst EPS estimates have been cut recently, suggesting the decline reflects deteriorating expectations rather than overreaction.`);
  } else if (fundamentals.marginTrend.direction === "compressing" && fundamentals.revenueTrend.direction === "shrinking") {
    sentences.push(`Both revenue and gross margins are deteriorating — cheapness appears to be driven by fundamental weakness, not overreaction.`);
  } else if (verdict === "Potential Bargain") {
    sentences.push(`Revenue and margins are holding up and there is no balance-sheet stress, suggesting the drop may be an overreaction.`);
  } else if (verdict === "Repricing") {
    sentences.push(`Fundamentals are stable but the stock has not yet de-rated enough to offer a clear margin of safety at current multiples.`);
  } else {
    sentences.push(`Fundamental signals are mixed; treat this as a watchlist candidate pending more data.`);
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
