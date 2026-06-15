import { logger } from "./logger";
import type { TimePeriod, Market } from "./polygon";

const POLYGON_BASE = "https://api.polygon.io";

// Classification thresholds (percentage-point excess move)
export const EXCESS_MOVE_COMPANY_THRESHOLD = -2.0;
export const EXCESS_MOVE_OUTPERFORMER_THRESHOLD = 1.0;

// Sector ETF map — GICS broad sector / Finnhub industry strings → SPDR ETF
const SECTOR_TO_ETF: Record<string, string> = {
  // Technology
  Technology:                        "XLK",
  Software:                          "XLK",
  Semiconductors:                    "XLK",
  "Semiconductor Equipment":         "XLK",
  "IT Services":                     "XLK",
  Hardware:                          "XLK",
  "Electronic Equipment":            "XLK",
  "Computer Hardware":               "XLK",
  // Health Care
  "Health Care":                     "XLV",
  Healthcare:                        "XLV",
  Biotechnology:                     "XLV",
  Pharmaceuticals:                   "XLV",
  "Drug Manufacturers":              "XLV",
  "Medical Devices":                 "XLV",
  "Medical Instruments":             "XLV",
  "Healthcare Plans":                "XLV",
  // Financials
  Financials:                        "XLF",
  Finance:                           "XLF",
  Banking:                           "XLF",
  "Banks—Diversified":               "XLF",
  Insurance:                         "XLF",
  "Capital Markets":                 "XLF",
  "Asset Management":                "XLF",
  // Consumer Discretionary
  "Consumer Discretionary":          "XLY",
  "Consumer Cyclical":               "XLY",
  Retail:                            "XLY",
  "Specialty Retail":                "XLY",
  Automotive:                        "XLY",
  "Auto Manufacturers":              "XLY",
  "Home Improvement":                "XLY",
  // Communication Services
  "Communication Services":          "XLC",
  Communications:                    "XLC",
  Media:                             "XLC",
  "Interactive Media":               "XLC",
  Telecommunications:                "XLC",
  Telecom:                           "XLC",
  Entertainment:                     "XLC",
  // Industrials
  Industrials:                       "XLI",
  Manufacturing:                     "XLI",
  "Aerospace & Defense":             "XLI",
  Aerospace:                         "XLI",
  Transportation:                    "XLI",
  "Trucking & Logistics":            "XLI",
  "Machinery & Equipment":           "XLI",
  // Consumer Staples
  "Consumer Staples":                "XLP",
  "Consumer Defensive":              "XLP",
  Food:                              "XLP",
  "Food Distribution":               "XLP",
  Beverages:                         "XLP",
  Household:                         "XLP",
  "Personal Products":               "XLP",
  // Energy
  Energy:                            "XLE",
  "Oil & Gas":                       "XLE",
  "Oil & Gas Exploration":           "XLE",
  "Oil & Gas Integrated":            "XLE",
  // Utilities
  Utilities:                         "XLU",
  "Electric Utilities":              "XLU",
  "Gas Utilities":                   "XLU",
  // Real Estate
  "Real Estate":                     "XLRE",
  REIT:                              "XLRE",
  "Diversified REITs":               "XLRE",
  // Materials
  Materials:                         "XLB",
  "Basic Materials":                 "XLB",
  Chemicals:                         "XLB",
  Mining:                            "XLB",
  Metals:                            "XLB",
};

// Market overrides — FTSE stocks benchmark against UK equity ETF
const MARKET_BENCHMARK: Partial<Record<Market, string>> = {
  FTSE100: "EWU",
  FTSE250: "EWU",
};

const FALLBACK_BENCHMARK = "SPY";

const benchmarkCache = new Map<string, { data: BenchmarkReturn; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface BenchmarkReturn {
  etfTicker: string;
  percentChange: number | null;
  period: TimePeriod;
  error?: string;
}

/** Resolve which benchmark ETF to use for a ticker's sector + market */
export function getBenchmarkTicker(
  finnhubSector: string | null,
  market: Market | null
): string {
  if (market) {
    const override = MARKET_BENCHMARK[market];
    if (override) return override;
  }
  if (finnhubSector) {
    const etf = SECTOR_TO_ETF[finnhubSector];
    if (etf) return etf;
  }
  return FALLBACK_BENCHMARK;
}

function tradingDaysAgo(n: number): string {
  const d = new Date();
  let skipped = 0;
  while (skipped < n) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) skipped++;
  }
  return d.toISOString().split("T")[0];
}

function periodLookback(period: TimePeriod): number {
  switch (period) {
    case "1h":  return 1;
    case "24h": return 1;
    case "1w":  return 5;
    case "1m":  return 21;
  }
}

interface PolyBar { o?: number; c?: number }
interface PolyAggResult { results?: PolyBar[]; resultsCount?: number }

async function fetchPolyAggs(url: string): Promise<PolyAggResult | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;
  const sep = url.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${url}${sep}apiKey=${apiKey}`);
    if (!res.ok) {
      logger.warn({ status: res.status, url }, "benchmark Polygon response not ok");
      return null;
    }
    return res.json() as Promise<PolyAggResult>;
  } catch (err) {
    logger.warn({ err }, "benchmark Polygon fetch threw");
    return null;
  }
}

/**
 * Fetches the percent change for a benchmark ETF over the given period.
 * Uses Polygon's single-ticker daily aggregates endpoint; cached 15 min.
 * For 1h/24h: uses (close - open) / open of the most recent daily bar.
 * For 1w/1m: uses (latest close - earliest close) / earliest close.
 */
export async function fetchBenchmarkReturn(
  etfTicker: string,
  period: TimePeriod
): Promise<BenchmarkReturn> {
  const cacheKey = `bm:${etfTicker}:${period}`;
  const cached = benchmarkCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const lookback = periodLookback(period);
  const prevDay = tradingDaysAgo(1);
  const startDay = lookback <= 1 ? prevDay : tradingDaysAgo(lookback);

  const url = `${POLYGON_BASE}/v2/aggs/ticker/${etfTicker}/range/1/day/${startDay}/${prevDay}?adjusted=true&sort=asc&limit=50`;
  const data = await fetchPolyAggs(url);

  const fail = (error: string): BenchmarkReturn => {
    const r: BenchmarkReturn = { etfTicker, percentChange: null, period, error };
    benchmarkCache.set(cacheKey, { data: r, expiresAt: Date.now() + CACHE_TTL_MS });
    return r;
  };

  if (!data?.results || data.results.length === 0) {
    return fail(`No results from Polygon for ${etfTicker}`);
  }

  let percentChange: number;

  if (lookback <= 1) {
    const bar = data.results[data.results.length - 1];
    if (!bar.o || bar.o === 0) return fail("Invalid bar — zero open price");
    const close = bar.c ?? bar.o;
    percentChange = ((close - bar.o) / bar.o) * 100;
  } else {
    const first = data.results[0];
    const last = data.results[data.results.length - 1];
    const firstClose = first.c ?? first.o;
    const lastClose = last.c ?? last.o ?? firstClose;
    if (!firstClose || firstClose === 0) return fail("Invalid start bar — zero close");
    if (lastClose === undefined) return fail("Invalid end bar — no close/open price");
    percentChange = ((lastClose - firstClose) / firstClose) * 100;
  }

  const result: BenchmarkReturn = { etfTicker, percentChange, period };
  benchmarkCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
