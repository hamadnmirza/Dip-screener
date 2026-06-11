/**
 * Financial Modeling Prep (FMP) API client.
 * Fetches valuation multiples, profile, and quarterly income statement data.
 * Results are cached per ticker for 1 hour.
 */

import { logger } from "./logger";

const FMP_BASE = "https://financialmodelingprep.com/api/v3";
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

// ── Response shapes ───────────────────────────────────────────────────────────

interface FmpRatiosTtm {
  peRatioTTM?: number | null;
  pegRatioTTM?: number | null;
  priceToFreeCashFlowsRatioTTM?: number | null;
  // Some FMP accounts return slightly different field names
  pfcfRatioTTM?: number | null;
}

interface FmpKeyMetricsTtm {
  enterpriseValueOverEBITDATTM?: number | null;
  evToSalesTTM?: number | null;
  netDebtToEBITDATTM?: number | null;
  debtToEbitdaTTM?: number | null;
  freeCashFlowTTM?: number | null;
  freeCashFlowPerShareTTM?: number | null;
}

interface FmpProfile {
  sector?: string | null;
  industry?: string | null;
  mktCap?: number | null;
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
    fmpFetch<FmpRatiosTtm[]>(`/ratios-ttm/${ticker}`),
    fmpFetch<FmpKeyMetricsTtm[]>(`/key-metrics-ttm/${ticker}`),
    fmpFetch<FmpProfile[]>(`/profile/${ticker}`),
  ]);

  if (!ratiosArr && !metricsArr) return null;

  const ratios: FmpRatiosTtm = (ratiosArr?.[0]) ?? {};
  const metrics: FmpKeyMetricsTtm = (metricsArr?.[0]) ?? {};
  const profile: FmpProfile = (profileArr?.[0]) ?? {};

  const pe = num(ratios.peRatioTTM);
  const isUnprofitable = pe === null || pe < 0;

  const result: FmpValuationData = {
    pe: pe !== null && pe > 0 ? pe : null,
    peg: num(ratios.pegRatioTTM),
    pFcf: num(ratios.priceToFreeCashFlowsRatioTTM ?? ratios.pfcfRatioTTM),
    evEbitda: num(metrics.enterpriseValueOverEBITDATTM),
    evRevenue: num(metrics.evToSalesTTM),
    debtToEbitda: num(metrics.netDebtToEBITDATTM ?? metrics.debtToEbitdaTTM),
    fcfTtm: num(metrics.freeCashFlowTTM),
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
    `/income-statement/${ticker}?period=quarter&limit=5`
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

// ── Utility ───────────────────────────────────────────────────────────────────

function num(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !isFinite(v)) return null;
  return v;
}
