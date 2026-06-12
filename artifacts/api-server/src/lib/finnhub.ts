/**
 * Finnhub API client.
 * - /stock/metric       → valuation multiples + growth metrics (P/E, P/S, revenue growth, gross margin)
 * - /stock/profile2     → industry classification
 * - /stock/recommendation → analyst buy/hold/sell counts
 * - /stock/eps-estimate → EPS estimate trend for revision direction
 *
 * No daily request cap on the free tier.
 * Results are cached per ticker for 1 hour.
 */

import { logger } from "./logger";
import type { EstimateRevisions } from "./scoring";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const finnhubCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = finnhubCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    finnhubCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  finnhubCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function finnhubFetch<T>(path: string): Promise<T | null> {
  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) {
    logger.warn("FINNHUB_KEY not set — skipping Finnhub fetch");
    return null;
  }
  const sep = path.includes("?") ? "&" : "?";
  const url = `${FINNHUB_BASE}${path}${sep}token=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      logger.warn({ status: res.status, path }, "Finnhub API error");
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    logger.warn({ path, err }, "Finnhub fetch failed");
    return null;
  }
}

// ── Response shapes ───────────────────────────────────────────────────────────

interface FinnhubBasicMetrics {
  peBasicExclExtraTTM?: number | null;
  psAnnual?: number | null;
  grossMarginTTM?: number | null;
  revenueGrowthTTMYoy?: number | null;
  netProfitMarginTTM?: number | null;
  /** Return on Investment TTM — percent form (e.g. 26.33 = 26.33%). Proxy for ROIC. */
  roiTTM?: number | null;
  /**
   * Total debt / total equity — ratio form (e.g. 0.26 = 26%, NOT percentage).
   * Negative when equity is negative (distressed). Prefer quarterly (most recent).
   */
  "totalDebt/totalEquityQuarterly"?: number | null;
  "totalDebt/totalEquityAnnual"?: number | null;
}

interface FinnhubMetricResponse {
  metric: FinnhubBasicMetrics;
  symbol: string;
}

interface FinnhubProfile2 {
  finnhubIndustry?: string | null;
  name?: string | null;
}

interface FinnhubRecommendation {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;
}

interface FinnhubEpsEstimate {
  epsAvg: number;
  period: string;
}

interface FinnhubEpsEstimateResponse {
  data: FinnhubEpsEstimate[];
  symbol: string;
  freq: string;
}

// ── Public data types ─────────────────────────────────────────────────────────

export interface FinnhubValuationData {
  /** P/E TTM (null for unprofitable companies) */
  pe: number | null;
  /** Price-to-Sales (annual) */
  ps: number | null;
  /** Gross margin TTM (percent, e.g. 74.15) */
  grossMarginTtm: number | null;
  /** Revenue growth YoY TTM (percent, e.g. 70.68) */
  revenueGrowthYoy: number | null;
  /** Finnhub industry string, used for sector median lookup */
  sector: string | null;
  /** True when the company has negative or no earnings */
  isUnprofitable: boolean;
  /**
   * Return on Investment TTM — percent form (e.g. 26.33 = 26.33%).
   * Used as a proxy for ROIC. Divide by 100 before comparing against decimal thresholds.
   * Null when unavailable or degenerate (|roi| > 200%).
   */
  roiTtm: number | null;
  /**
   * Total Debt / Total Equity ratio (ratio form, e.g. 0.26 = 0.26x).
   * Prefer quarterly (most recent); falls back to annual.
   * Negative values indicate negative shareholder equity (distressed).
   * Null when unavailable.
   */
  deRatio: number | null;
}

export interface FinnhubAnalystData {
  buy: number;
  hold: number;
  sell: number;
}

// ── Fetch functions ───────────────────────────────────────────────────────────

/**
 * Fetches valuation multiples and growth metrics from Finnhub /stock/metric.
 * Combined with /stock/profile2 for sector classification.
 * No daily cap on the free tier — safe to call for all visible equity tickers.
 */
export async function fetchFinnhubValuation(ticker: string): Promise<FinnhubValuationData | null> {
  const cacheKey = `valuation:${ticker}`;
  const cached = getCached<FinnhubValuationData>(cacheKey);
  if (cached) return cached;

  const [metricRes, profileRes] = await Promise.all([
    finnhubFetch<FinnhubMetricResponse>(`/stock/metric?symbol=${ticker}&metric=all`),
    finnhubFetch<FinnhubProfile2>(`/stock/profile2?symbol=${ticker}`),
  ]);

  if (!metricRes?.metric) return null;

  const m = metricRes.metric;
  const pe = num(m.peBasicExclExtraTTM);
  const isUnprofitable = pe === null || pe <= 0;

  const rawRoi = num(m.roiTTM);
  // Filter degenerate values (negative equity → huge |ROI|)
  const roiTtm = rawRoi !== null && Math.abs(rawRoi) <= 200 ? rawRoi : null;

  // D/E: prefer quarterly (most recent), fall back to annual
  // Allow negative values (negative equity = distressed). Cap at ±500 to filter data errors.
  const rawDeQ = num(m["totalDebt/totalEquityQuarterly"]);
  const rawDeA = num(m["totalDebt/totalEquityAnnual"]);
  const rawDe = rawDeQ ?? rawDeA;
  const deRatio = rawDe !== null && Math.abs(rawDe) <= 500 ? rawDe : null;

  const result: FinnhubValuationData = {
    pe: pe !== null && pe > 0 ? pe : null,
    ps: num(m.psAnnual),
    grossMarginTtm: num(m.grossMarginTTM),
    revenueGrowthYoy: num(m.revenueGrowthTTMYoy),
    sector: profileRes?.finnhubIndustry ?? null,
    isUnprofitable,
    roiTtm,
    deRatio,
  };

  setCache(cacheKey, result);
  return result;
}

export async function fetchFinnhubRecommendations(ticker: string): Promise<FinnhubAnalystData | null> {
  const cacheKey = `rec:${ticker}`;
  const cached = getCached<FinnhubAnalystData>(cacheKey);
  if (cached) return cached;

  const data = await finnhubFetch<FinnhubRecommendation[]>(`/stock/recommendation?symbol=${ticker}`);
  if (!data || data.length === 0) return null;

  const latest = data[0];
  const result: FinnhubAnalystData = {
    buy: (latest.buy ?? 0) + (latest.strongBuy ?? 0),
    hold: latest.hold ?? 0,
    sell: (latest.sell ?? 0) + (latest.strongSell ?? 0),
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Fetches EPS estimate trend to derive revision direction.
 * Degrades gracefully if unavailable on the free tier.
 */
export async function fetchEstimateRevisions(ticker: string): Promise<EstimateRevisions> {
  const cacheKey = `eps:${ticker}`;
  const cached = getCached<EstimateRevisions>(cacheKey);
  if (cached) return cached;

  const data = await finnhubFetch<FinnhubEpsEstimateResponse>(
    `/stock/eps-estimate?symbol=${ticker}&freq=quarterly`
  );

  if (!data?.data || data.data.length < 2) {
    const result: EstimateRevisions = { available: false };
    setCache(cacheKey, result);
    return result;
  }

  const sorted = [...data.data].sort((a, b) => a.period.localeCompare(b.period));
  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];

  if (!prev || !curr || prev.epsAvg === 0) {
    const result: EstimateRevisions = { available: false };
    setCache(cacheKey, result);
    return result;
  }

  const change = (curr.epsAvg - prev.epsAvg) / Math.abs(prev.epsAvg);
  let direction: "up" | "flat" | "down";
  if (change > 0.02) direction = "up";
  else if (change < -0.02) direction = "down";
  else direction = "flat";

  const result: EstimateRevisions = { available: true, direction };
  setCache(cacheKey, result);
  return result;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function num(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !isFinite(v)) return null;
  return v;
}
