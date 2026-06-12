/**
 * Financial Modeling Prep (FMP) API client.
 * Uses the stable API: https://financialmodelingprep.com/stable/
 * Fetches valuation multiples, profile, and quarterly income statement data.
 * Results are cached per ticker for 1 hour.
 */

import { logger } from "./logger";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const FMP_V3_BASE = "https://financialmodelingprep.com/api/v3";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const fmpCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = fmpCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    fmpCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  fmpCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function fmpFetch<T>(path: string): Promise<T | null> {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) {
    logger.warn("FMP_KEY not set — skipping FMP fetch");
    return null;
  }
  const sep = path.includes("?") ? "&" : "?";
  const url = `${FMP_BASE}${path}${sep}apikey=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      logger.warn({ status: res.status, path }, "FMP API error");
      return null;
    }
    const json = await res.json();
    // FMP returns an error object { "Error Message": "..." } on bad tickers
    if (json && typeof json === "object" && !Array.isArray(json) && "Error Message" in json) {
      logger.debug({ path, msg: (json as Record<string, unknown>)["Error Message"] }, "FMP ticker not found");
      return null;
    }
    return json as T;
  } catch (err) {
    logger.warn({ path, err }, "FMP fetch failed");
    return null;
  }
}

// ── FMP rate-limit queue ──────────────────────────────────────────────────────
// FMP free tier has a strict burst limit. Serialise all un-cached calls with a
// small inter-request gap so we never fire more than ~4 requests/second.
// Once a ticker is cached (1 h TTL), it never touches this queue again.

const FMP_INTER_REQUEST_MS = 250; // 4 req/s max
let fmpQueueTail: Promise<void> = Promise.resolve();

function withFmpRateLimit<T>(fn: () => Promise<T | null>): Promise<T | null> {
  const result: Promise<T | null> = fmpQueueTail.then(fn, fn);
  // Extend the tail: whatever came before + this call + cooldown
  fmpQueueTail = result
    .then(() => new Promise<void>((r) => setTimeout(r, FMP_INTER_REQUEST_MS)))
    .catch(() => new Promise<void>((r) => setTimeout(r, FMP_INTER_REQUEST_MS)));
  return result;
}

// ── HTTP helper (v3 API) ──────────────────────────────────────────────────────

async function fmpV3Fetch<T>(path: string): Promise<T | null> {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) return null;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${FMP_V3_BASE}${path}${sep}apikey=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      logger.warn({ status: res.status, path }, "FMP v3 API error");
      return null;
    }
    const json = await res.json();
    if (json && typeof json === "object" && !Array.isArray(json) && "Error Message" in json) return null;
    return json as T;
  } catch (err) {
    logger.warn({ path, err }, "FMP v3 fetch failed");
    return null;
  }
}

// ── Response shapes (stable API field names) ──────────────────────────────────

interface FmpRatiosTtm {
  // Stable API uses full camelCase names
  priceToEarningsRatioTTM?: number | null;
  priceToEarningsGrowthRatioTTM?: number | null;
  priceToFreeCashFlowRatioTTM?: number | null;
}

interface FmpKeyMetricsTtm {
  evToEBITDATTM?: number | null;
  evToSalesTTM?: number | null;
  netDebtToEBITDATTM?: number | null;
}

interface FmpProfile {
  sector?: string | null;
  industry?: string | null;
  marketCap?: number | null;
}

interface FmpIncomeStatement {
  date?: string;
  revenue?: number | null;
  grossProfit?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
}

// ── Public data types ─────────────────────────────────────────────────────────

export interface FmpValuationData {
  pe: number | null;
  peg: number | null;
  pFcf: number | null;
  evEbitda: number | null;
  evRevenue: number | null;
  debtToEbitda: number | null;
  fcfTtm: number | null;
  sector: string | null;
  isUnprofitable: boolean;
}

export interface FmpQuarterlyData {
  /** Revenue in $ for the last 4+ quarters, oldest→newest */
  revenue: number[];
  /** Gross margin % for the last 4+ quarters, oldest→newest */
  grossMargin: number[];
}

// ── Fetch functions ───────────────────────────────────────────────────────────

export async function fetchFmpValuation(ticker: string): Promise<FmpValuationData | null> {
  const cacheKey = `valuation:${ticker}`;
  const cached = getCached<FmpValuationData>(cacheKey);
  if (cached) return cached;

  const [ratiosArr, metricsArr, profileArr] = await Promise.all([
    fmpFetch<FmpRatiosTtm[]>(`/ratios-ttm?symbol=${ticker}`),
    fmpFetch<FmpKeyMetricsTtm[]>(`/key-metrics-ttm?symbol=${ticker}`),
    fmpFetch<FmpProfile[]>(`/profile?symbol=${ticker}`),
  ]);

  if (!ratiosArr && !metricsArr) return null;

  const ratios: FmpRatiosTtm = (ratiosArr?.[0]) ?? {};
  const metrics: FmpKeyMetricsTtm = (metricsArr?.[0]) ?? {};
  const profile: FmpProfile = (profileArr?.[0]) ?? {};

  const pe = num(ratios.priceToEarningsRatioTTM);
  const isUnprofitable = pe === null || pe < 0;

  const result: FmpValuationData = {
    pe: pe !== null && pe > 0 ? pe : null,
    peg: num(ratios.priceToEarningsGrowthRatioTTM),
    pFcf: num(ratios.priceToFreeCashFlowRatioTTM),
    evEbitda: num(metrics.evToEBITDATTM),
    evRevenue: num(metrics.evToSalesTTM),
    debtToEbitda: num(metrics.netDebtToEBITDATTM),
    fcfTtm: null, // not needed for scoring; key-metrics-ttm doesn't return absolute FCF
    sector: profile.sector ?? null,
    isUnprofitable,
  };

  setCache(cacheKey, result);
  return result;
}

export async function fetchFmpQuarterly(ticker: string): Promise<FmpQuarterlyData | null> {
  const cacheKey = `quarterly:${ticker}`;
  const cached = getCached<FmpQuarterlyData>(cacheKey);
  if (cached) return cached;

  const stmts = await fmpFetch<FmpIncomeStatement[]>(
    `/income-statement?symbol=${ticker}&period=quarter&limit=5`
  );

  if (!stmts || stmts.length < 3) return null;

  // FMP returns newest first — reverse to oldest→newest
  const ordered = [...stmts].reverse();

  const revenue = ordered
    .map((s) => s.revenue ?? 0)
    .filter((v) => v > 0);

  const grossMargin = ordered
    .map((s) => {
      if (!s.revenue || s.revenue === 0 || s.grossProfit == null) return null;
      return s.grossProfit / s.revenue;
    })
    .filter((v): v is number => v !== null);

  if (revenue.length < 3) return null;

  const result: FmpQuarterlyData = { revenue, grossMargin };
  setCache(cacheKey, result);
  return result;
}

// ── ROIC (v3 API) ─────────────────────────────────────────────────────────────

interface FmpKeyMetricsTtmV3 {
  roicTTM?: number | null;
}

export interface FmpRoicData {
  /** ROIC TTM as a decimal (e.g. 0.16 = 16%). null if unavailable or degenerate. */
  roicTTM: number | null;
}

/**
 * Fetches ROIC TTM from FMP /key-metrics-ttm (v3).
 * Degenerate values (|roic| > 200%, e.g. from negative invested capital) → null.
 */
export async function fetchFmpRoic(ticker: string): Promise<FmpRoicData | null> {
  const cacheKey = `roic:${ticker}`;
  const cached = getCached<FmpRoicData>(cacheKey);
  if (cached) return cached;

  // Enqueue through the rate limiter — all un-cached calls run one at a time
  return withFmpRateLimit(async () => {
    // Re-check cache: another queued request may have populated it while we waited
    const cached2 = getCached<FmpRoicData>(cacheKey);
    if (cached2) return cached2;

    const data = await fmpV3Fetch<FmpKeyMetricsTtmV3[]>(`/key-metrics-ttm/${ticker}`);
    if (!data || data.length === 0) return null;

    const raw = data[0]?.roicTTM ?? null;
    const roicTTM =
      raw !== null && isFinite(raw) && Math.abs(raw) <= 2.0 ? raw : null;

    const result: FmpRoicData = { roicTTM };
    setCache(cacheKey, result);
    return result;
  });
}

// ── Price target (v3 API) ─────────────────────────────────────────────────────

interface FmpPriceTargetConsensus {
  symbol?: string;
  targetHigh?: number | null;
  targetLow?: number | null;
  targetConsensus?: number | null;
  targetMedian?: number | null;
}

export interface PriceTargetData {
  targetMedian: number;
  targetHigh: number;
  targetLow: number;
  lastUpdated: string | null;
}

export async function fetchPriceTarget(ticker: string): Promise<PriceTargetData | null> {
  const cacheKey = `pt:${ticker}`;
  if (fmpCache.has(cacheKey)) return getCached<PriceTargetData>(cacheKey);

  return withFmpRateLimit(async () => {
    // Re-check after waiting in queue
    if (fmpCache.has(cacheKey)) return getCached<PriceTargetData>(cacheKey);

    // FMP /price-target-consensus requires a paid plan (free tier returns 403/429).
    // The call is kept in place so it works automatically when a paid key is configured.
    const raw = await fmpV3Fetch<FmpPriceTargetConsensus[]>(
      `/price-target-consensus?symbol=${ticker}`
    );

    const item = Array.isArray(raw) ? raw[0] : null;
    const median = num(item?.targetMedian) ?? num(item?.targetConsensus);
    const high = num(item?.targetHigh);
    const low = num(item?.targetLow);

    if (median === null || median <= 0) {
      setCache(cacheKey, null as unknown as PriceTargetData);
      return null;
    }

    const result: PriceTargetData = {
      targetMedian: median,
      targetHigh: high ?? median,
      targetLow: low ?? median,
      lastUpdated: null,
    };

    setCache(cacheKey, result);
    return result;
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

function num(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !isFinite(v)) return null;
  return v;
}
