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
  ROIC_THRESHOLDS,
  getRoicSectorConfig,
  getDeConfig,
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

// ── ROIC types ────────────────────────────────────────────────────────────────

export type RoicFlag =
  | "strong_positive"
  | "positive"
  | "neutral"
  | "negative"
  | "strong_negative"
  | "skipped"
  | "missing";

export interface RoicResult {
  flag: RoicFlag;
  /** ROIC value as decimal (e.g. 0.16 = 16%). null for skipped/missing. */
  value: number | null;
  /** Human-readable one-line interpretation for the detail view. */
  note: string;
}

export interface RoicModification {
  /** Final verdict after applying the ROIC notch shift. */
  verdict: VerdictLabel;
  /** True if ROIC changed the base verdict. */
  shifted: boolean;
  shiftDirection?: "up" | "down";
  /** True when strong_negative cap held the verdict at "At value". */
  capped?: boolean;
}

// ── D/E types ─────────────────────────────────────────────────────────────────

export type DeFlag =
  | "distressed"  // negative equity: liabilities exceed assets
  | "normal"      // within sector-typical range
  | "elevated"    // above normal, not yet "high"
  | "high"        // significantly above sector norm
  | "skipped"     // sector where D/E is not meaningful (e.g. Financials)
  | "missing";    // data unavailable

export interface DeResult {
  flag: DeFlag;
  /** D/E ratio value (ratio form, e.g. 0.26 = 0.26x). null for skipped/missing. */
  value: number | null;
  /** Sector-normal thresholds used for classification. null for skipped. */
  sectorBand: { elevated: number; high: number } | null;
  /** Human-readable one-line interpretation for the detail view. */
  note: string;
  /** Optional UI tag (e.g. "High leverage", "Negative shareholder equity — verify cause", "Debt-free"). */
  tag?: string;
}

export interface DeModification {
  /** Final verdict after applying the D/E adjustment. */
  verdict: VerdictLabel;
  /** True if D/E changed the verdict. */
  shifted: boolean;
  shiftDirection?: "down";
  /** True when distressed cap held the verdict at "At value". */
  capped?: boolean;
}

export interface VerdictResult {
  ticker: string;
  verdict: VerdictLabel | null;
  /** Verdict before any modifiers (ROIC, D/E) were applied. */
  verdictBase: VerdictLabel | null;
  /** Verdict after ROIC modifier, before D/E modifier. Equals verdict when D/E had no effect. */
  verdictAfterRoic: VerdictLabel | null;
  cheapness: CheapnessResult;
  fundamentals: FundamentalsResult;
  analysts: AnalystCounts | null;
  roic: RoicResult;
  de: DeResult;
  priceTarget: { targetMedian: number; targetHigh: number; targetLow: number; lastUpdated: string | null } | null;
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

// ── ROIC scoring ──────────────────────────────────────────────────────────────

/**
 * Computes the ROIC quality flag for a ticker.
 * All thresholds live in ROIC_THRESHOLDS in sector-medians.ts.
 * Capital-intensive sectors (Utilities, Telecom) have lower effective thresholds.
 */
export function computeRoicFlag(
  roic: number | null,
  finnhubIndustry: string | null
): RoicResult {
  const { skip, capitalIntensive } = getRoicSectorConfig(finnhubIndustry);

  if (skip) {
    return {
      flag: "skipped",
      value: null,
      note: "ROIC: n/a — not meaningful for financial companies.",
    };
  }

  if (roic === null || !isFinite(roic)) {
    return {
      flag: "missing",
      value: null,
      note: "ROIC unavailable — no modifier applied.",
    };
  }

  const reduction = capitalIntensive ? ROIC_THRESHOLDS.CAPITAL_INTENSIVE_REDUCTION : 0;
  const pct = Math.round(roic * 100);
  const capNote = capitalIntensive ? " (adjusted for capital-intensive sector)" : "";

  if (roic < ROIC_THRESHOLDS.STRONG_NEGATIVE_MAX) {
    return {
      flag: "strong_negative",
      value: roic,
      note: `ROIC ${pct}% — negative; actively destroying capital.`,
    };
  }

  const negMax   = ROIC_THRESHOLDS.NEGATIVE_MAX   - reduction;
  const neutMax  = ROIC_THRESHOLDS.NEUTRAL_MAX     - reduction;
  const posMax   = ROIC_THRESHOLDS.POSITIVE_MAX    - reduction;

  if (roic < negMax) {
    return {
      flag: "negative",
      value: roic,
      note: `ROIC ${pct}% — below cost of capital (~${Math.round(negMax * 100)}%${capNote}); growth at this return destroys value.`,
    };
  }

  if (roic <= neutMax) {
    return {
      flag: "neutral",
      value: roic,
      note: `ROIC ${pct}% — roughly earning its cost of capital; neither creating nor destroying significant value.`,
    };
  }

  if (roic <= posMax) {
    return {
      flag: "positive",
      value: roic,
      note: `ROIC ${pct}% — above cost of capital${capNote}; growth is creating shareholder value.`,
    };
  }

  return {
    flag: "strong_positive",
    value: roic,
    note: `ROIC ${pct}% — well above cost of capital${capNote}; likely indicates a durable competitive moat.`,
  };
}

// ── D/E scoring ───────────────────────────────────────────────────────────────

/**
 * Computes the D/E leverage flag for a ticker.
 * Thresholds live in SECTOR_DE_BANDS in sector-medians.ts.
 * Financial Services: skipped (leverage is the business model).
 * Negative D/E: distressed (negative shareholder equity).
 */
export function computeDeFlag(
  deRatio: number | null,
  finnhubIndustry: string | null
): DeResult {
  const { skip, band, sectorName } = getDeConfig(finnhubIndustry);

  if (skip) {
    return {
      flag: "skipped",
      value: null,
      sectorBand: null,
      note: "D/E: n/a for financial companies — leverage is the business model.",
    };
  }

  if (deRatio === null || !isFinite(deRatio)) {
    return {
      flag: "missing",
      value: null,
      sectorBand: band,
      note: "D/E unavailable — no adjustment applied.",
    };
  }

  // Negative equity (liabilities exceed assets)
  if (deRatio < 0) {
    return {
      flag: "distressed",
      value: deRatio,
      sectorBand: band,
      note: `D/E ${deRatio.toFixed(2)}× — negative shareholder equity; liabilities exceed assets. Some healthy companies show negative equity from large buyback programs.`,
      tag: "Negative shareholder equity — verify cause",
    };
  }

  const { elevated, high } = band;
  const sectorLabel = sectorName ?? "sector";

  // Debt-free
  if (deRatio === 0) {
    return {
      flag: "normal",
      value: 0,
      sectorBand: band,
      note: `Debt-free — no leverage risk; clean balance sheet.`,
      tag: "Debt-free",
    };
  }

  // Normal
  if (deRatio <= elevated) {
    return {
      flag: "normal",
      value: deRatio,
      sectorBand: band,
      note: `D/E ${deRatio.toFixed(2)}× — within normal range for ${sectorLabel} (≤${elevated}×); balance sheet not a concern.`,
    };
  }

  // Elevated
  if (deRatio <= high) {
    return {
      flag: "elevated",
      value: deRatio,
      sectorBand: band,
      note: `D/E ${deRatio.toFixed(2)}× vs ~${elevated}× typical for ${sectorLabel} — elevated leverage; meaningful earnings pressure could amplify downside.`,
    };
  }

  // High
  return {
    flag: "high",
    value: deRatio,
    sectorBand: band,
    note: `D/E ${deRatio.toFixed(2)}× vs ~${elevated}× typical for ${sectorLabel} — equity returns will be amplified in both directions; distress risk elevated if earnings weaken.`,
    tag: "High leverage",
  };
}

/**
 * Applies an ASYMMETRIC D/E leverage adjustment to the current verdict.
 * normal      → no adjustment (absence of risk ≠ evidence of cheapness; never upgrades).
 * elevated    → no shift alone, BUT shift down if debtToEbitda > 3 (combined distress signal).
 * high        → shift one notch unfavourable.
 * distressed  → cap verdict at "At value" regardless of all other signals.
 * skipped/missing → no change.
 */
export function applyDeModifier(
  currentVerdict: VerdictLabel,
  de: DeResult,
  debtToEbitda: number | null
): DeModification {
  const { flag } = de;

  // Distressed: cap at "At value" — the hardest rule, overrides everything
  if (flag === "distressed") {
    if (currentVerdict === "Undervalued") {
      return { verdict: "At value", shifted: true, shiftDirection: "down", capped: true };
    }
    return { verdict: currentVerdict, shifted: false };
  }

  // High: shift one notch unfavourable
  if (flag === "high") {
    const idx = VERDICT_SCALE.indexOf(currentVerdict);
    const newIdx = Math.min(VERDICT_SCALE.length - 1, idx + 1);
    if (newIdx === idx) return { verdict: currentVerdict, shifted: false };
    return { verdict: VERDICT_SCALE[newIdx]!, shifted: true, shiftDirection: "down" };
  }

  // Elevated: shift down ONLY when earnings-coverage gate (debt/EBITDA > 3) is also breached
  // If debtToEbitda is unavailable (null), the gate is not triggered — no adjustment.
  if (flag === "elevated") {
    if (debtToEbitda !== null && debtToEbitda > 3) {
      const idx = VERDICT_SCALE.indexOf(currentVerdict);
      const newIdx = Math.min(VERDICT_SCALE.length - 1, idx + 1);
      if (newIdx === idx) return { verdict: currentVerdict, shifted: false };
      return { verdict: VERDICT_SCALE[newIdx]!, shifted: true, shiftDirection: "down" };
    }
    return { verdict: currentVerdict, shifted: false };
  }

  // normal, skipped, missing: no adjustment
  return { verdict: currentVerdict, shifted: false };
}

/** Ordered scale from most- to least-favourable. */
const VERDICT_SCALE: VerdictLabel[] = ["Undervalued", "At value", "Overvalued"];

/**
 * Applies a one-notch ROIC quality modifier to the base cheapness verdict.
 * positive/strong_positive → shift towards "Undervalued".
 * negative/strong_negative → shift towards "Overvalued".
 * Exception: strong_negative can never produce "Undervalued" — capped at "At value".
 * neutral/skipped/missing  → no change.
 */
export function applyRoicModifier(
  baseVerdict: VerdictLabel,
  roic: RoicResult
): RoicModification {
  const { flag } = roic;

  if (flag === "neutral" || flag === "skipped" || flag === "missing") {
    return { verdict: baseVerdict, shifted: false };
  }

  const idx = VERDICT_SCALE.indexOf(baseVerdict);

  if (flag === "positive" || flag === "strong_positive") {
    const newIdx = Math.max(0, idx - 1);
    if (newIdx === idx) return { verdict: baseVerdict, shifted: false };
    return { verdict: VERDICT_SCALE[newIdx]!, shifted: true, shiftDirection: "up" };
  }

  // negative or strong_negative
  if (flag === "strong_negative" && baseVerdict === "Undervalued") {
    // Cap: strong_negative can never produce "Undervalued"
    return { verdict: "At value", shifted: true, shiftDirection: "down", capped: true };
  }

  const newIdx = Math.min(VERDICT_SCALE.length - 1, idx + 1);
  if (newIdx === idx) return { verdict: baseVerdict, shifted: false };
  return { verdict: VERDICT_SCALE[newIdx]!, shifted: true, shiftDirection: "down" };
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
  verdict: VerdictLabel | null,
  roicContext?: { roic: RoicResult; modification: RoicModification; baseVerdict: VerdictLabel | null },
  deContext?: { de: DeResult; modification: DeModification; verdictBeforeDe: VerdictLabel | null }
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

  // Sentence 3 (optional): ROIC modifier narrative when the verdict was shifted
  if (roicContext?.modification.shifted) {
    const { modification, roic, baseVerdict } = roicContext;
    const roicPct = roic.value !== null ? `${Math.round(roic.value * 100)}%` : null;

    if (modification.shiftDirection === "up" && roicPct) {
      sentences.push(
        `${roicPct} ROIC signals a quality business — upgraded from "${baseVerdict}" to "${deContext?.modification.shifted ? deContext.verdictBeforeDe : verdict}".`
      );
    } else if (modification.shiftDirection === "down" && roicPct) {
      const capNote = modification.capped
        ? ` (strong-negative ROIC cannot produce "Undervalued")`
        : "";
      sentences.push(
        `${roicPct} ROIC below cost of capital reduces quality — downgraded from "${baseVerdict}"${capNote}.`
      );
    }
  }

  // Sentence 4 (optional): D/E modifier narrative when the verdict was shifted
  if (deContext?.modification.shifted) {
    const { modification, de, verdictBeforeDe } = deContext;
    const deVal = de.value !== null ? `${de.value.toFixed(2)}×` : null;
    const bandVal = de.sectorBand ? `${de.sectorBand.elevated}×` : null;

    if (modification.capped) {
      sentences.push(
        `Negative shareholder equity — verdict capped at "${verdict}"; verify cause before acting.`
      );
    } else if (deVal && bandVal) {
      sentences.push(
        `Screens cheap on multiples, but ${deVal} D/E against a ${bandVal} sector norm raises the bar — downgraded from "${verdictBeforeDe}" to "${verdict}".`
      );
    }
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
