/**
 * Finnhub API client.
 * Fetches analyst recommendations and EPS estimate trends.
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
    const json = await res.json();
    return json as T;
  } catch (err) {
    logger.warn({ path, err }, "Finnhub fetch failed");
    return null;
  }
}

// ── Response shapes ───────────────────────────────────────────────────────────

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
  epsHigh: number;
  epsLow: number;
  numberAnalysts: number;
  period: string;
  year: number;
}

interface FinnhubEpsEstimateResponse {
  data: FinnhubEpsEstimate[];
  symbol: string;
  freq: string;
}

// ── Public data types ─────────────────────────────────────────────────────────

export interface FinnhubAnalystData {
  buy: number;
  hold: number;
  sell: number;
}

// ── Fetch functions ───────────────────────────────────────────────────────────

export async function fetchFinnhubRecommendations(ticker: string): Promise<FinnhubAnalystData | null> {
  const cacheKey = `rec:${ticker}`;
  const cached = getCached<FinnhubAnalystData>(cacheKey);
  if (cached) return cached;

  const data = await finnhubFetch<FinnhubRecommendation[]>(`/stock/recommendation?symbol=${ticker}`);
  if (!data || data.length === 0) return null;

  // Use the most recent recommendation period
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
 * Fetches EPS estimate trend to derive estimate revision direction.
 * Uses quarterly consensus estimates — compares most recent to previous period.
 * Degrades gracefully if the endpoint is unavailable on the free tier.
 */
export async function fetchEstimateRevisions(ticker: string): Promise<EstimateRevisions> {
  const cacheKey = `eps:${ticker}`;
  const cached = getCached<EstimateRevisions>(cacheKey);
  if (cached) return cached;

  const data = await finnhubFetch<FinnhubEpsEstimateResponse>(`/stock/eps-estimate?symbol=${ticker}&freq=quarterly`);

  // Degrade gracefully if unavailable or insufficient data
  if (!data || !data.data || data.data.length < 2) {
    const result: EstimateRevisions = { available: false };
    setCache(cacheKey, result);
    return result;
  }

  // Sort by period ascending (oldest first)
  const sorted = [...data.data].sort((a, b) => a.period.localeCompare(b.period));

  // Compare the two most-recent forward estimates
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
