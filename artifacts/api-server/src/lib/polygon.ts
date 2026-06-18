import { logger } from "./logger";

const POLYGON_BASE = "https://api.polygon.io";

export type AssetType = "equity" | "crypto";
export type Market = "NASDAQ" | "FTSE100" | "FTSE250" | "SP500" | "CRYPTO";
export type TimePeriod = "1h" | "24h" | "1w" | "1m";
export type DropRange = "up_to_10" | "11_to_20" | "21_to_30" | "31_plus";

export interface SecurityData {
  ticker: string;
  name: string;
  assetType: AssetType;
  market: Market;
  currentPrice: number;
  previousPrice: number;
  percentChange: number;
  timePeriod: TimePeriod;
  currency: string;
  volume: number | null;
}

// Curated ticker metadata — used to filter & label grouped-daily results
const EQUITY_META: Record<string, { name: string; market: Market; currency: string }> = {
  // NASDAQ
  AAPL:  { name: "Apple Inc.",               market: "NASDAQ", currency: "USD" },
  MSFT:  { name: "Microsoft Corp.",          market: "NASDAQ", currency: "USD" },
  GOOGL: { name: "Alphabet Inc.",            market: "NASDAQ", currency: "USD" },
  AMZN:  { name: "Amazon.com Inc.",          market: "NASDAQ", currency: "USD" },
  META:  { name: "Meta Platforms Inc.",      market: "NASDAQ", currency: "USD" },
  NVDA:  { name: "NVIDIA Corp.",             market: "NASDAQ", currency: "USD" },
  TSLA:  { name: "Tesla Inc.",               market: "NASDAQ", currency: "USD" },
  NFLX:  { name: "Netflix Inc.",             market: "NASDAQ", currency: "USD" },
  INTC:  { name: "Intel Corp.",              market: "NASDAQ", currency: "USD" },
  AMD:   { name: "Advanced Micro Devices",   market: "NASDAQ", currency: "USD" },
  PYPL:  { name: "PayPal Holdings",          market: "NASDAQ", currency: "USD" },
  CSCO:  { name: "Cisco Systems",            market: "NASDAQ", currency: "USD" },
  ADBE:  { name: "Adobe Inc.",               market: "NASDAQ", currency: "USD" },
  QCOM:  { name: "Qualcomm Inc.",            market: "NASDAQ", currency: "USD" },
  AVGO:  { name: "Broadcom Inc.",            market: "NASDAQ", currency: "USD" },
  // S&P 500
  JPM:   { name: "JPMorgan Chase & Co.",     market: "SP500",  currency: "USD" },
  BAC:   { name: "Bank of America Corp.",    market: "SP500",  currency: "USD" },
  WMT:   { name: "Walmart Inc.",             market: "SP500",  currency: "USD" },
  JNJ:   { name: "Johnson & Johnson",        market: "SP500",  currency: "USD" },
  XOM:   { name: "Exxon Mobil Corp.",        market: "SP500",  currency: "USD" },
  V:     { name: "Visa Inc.",                market: "SP500",  currency: "USD" },
  PG:    { name: "Procter & Gamble Co.",     market: "SP500",  currency: "USD" },
  MA:    { name: "Mastercard Inc.",          market: "SP500",  currency: "USD" },
  HD:    { name: "Home Depot Inc.",          market: "SP500",  currency: "USD" },
  CVX:   { name: "Chevron Corp.",            market: "SP500",  currency: "USD" },
  LLY:   { name: "Eli Lilly and Co.",        market: "SP500",  currency: "USD" },
  ABBV:  { name: "AbbVie Inc.",              market: "SP500",  currency: "USD" },
  MRK:   { name: "Merck & Co.",             market: "SP500",  currency: "USD" },
  PFE:   { name: "Pfizer Inc.",              market: "SP500",  currency: "USD" },
  KO:    { name: "Coca-Cola Co.",            market: "SP500",  currency: "USD" },
  // FTSE 100 — traded on US exchanges as ADRs or via OTC; Polygon covers these
  SHEL:  { name: "Shell PLC",               market: "FTSE100", currency: "USD" },
  AZN:   { name: "AstraZeneca PLC",         market: "FTSE100", currency: "USD" },
  HSBC:  { name: "HSBC Holdings PLC",       market: "FTSE100", currency: "USD" },
  BP:    { name: "BP PLC",                  market: "FTSE100", currency: "USD" },
  UL:    { name: "Unilever PLC",            market: "FTSE100", currency: "USD" },
  GSK:   { name: "GSK PLC",                market: "FTSE100", currency: "USD" },
  RIO:   { name: "Rio Tinto PLC",           market: "FTSE100", currency: "USD" },
  DEO:   { name: "Diageo PLC",             market: "FTSE100", currency: "USD" },
  RELX:  { name: "RELX PLC",               market: "FTSE100", currency: "USD" },
  NGG:   { name: "National Grid PLC",       market: "FTSE100", currency: "USD" },
  // FTSE 250 (US-listed ADRs)
  MNDI:  { name: "Mondi PLC",              market: "FTSE250", currency: "USD" },
  IMB:   { name: "Imperial Brands PLC",    market: "FTSE250", currency: "USD" },
  HLN:   { name: "Haleon PLC",             market: "FTSE250", currency: "USD" },
};

const CRYPTO_META: Record<string, { name: string }> = {
  "X:BTCUSD":  { name: "Bitcoin" },
  "X:ETHUSD":  { name: "Ethereum" },
  "X:SOLUSD":  { name: "Solana" },
  "X:BNBUSD":  { name: "BNB" },
  "X:XRPUSD":  { name: "XRP" },
  "X:ADAUSD":  { name: "Cardano" },
  "X:AVAXUSD": { name: "Avalanche" },
  "X:DOTUSD":  { name: "Polkadot" },
  "X:LINKUSD": { name: "Chainlink" },
  "X:UNIUSD":  { name: "Uniswap" },
  "X:LTCUSD":  { name: "Litecoin" },
};

async function fetchWithKey(url: string): Promise<unknown> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error("POLYGON_API_KEY not set");
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}apiKey=${apiKey}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Polygon API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

interface AggBar {
  T: string;   // ticker
  c: number;   // close
  o: number;   // open
  v?: number;  // volume
  vw?: number; // volume-weighted avg
}

interface GroupedDailyResult {
  resultsCount?: number;
  results?: AggBar[];
}

/**
 * Fetch previous trading day's grouped daily snapshot for stocks.
 * One API call → open/close for every US stock.
 */
async function fetchGroupedDailyStocks(date: string): Promise<Map<string, AggBar>> {
  const url = `${POLYGON_BASE}/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true&include_otc=false`;
  const data = await fetchWithKey(url) as GroupedDailyResult;
  const map = new Map<string, AggBar>();
  for (const bar of data.results ?? []) {
    map.set(bar.T, bar);
  }
  return map;
}

/**
 * Fetch previous trading day's grouped daily snapshot for crypto.
 * One API call → open/close for every crypto pair.
 */
async function fetchGroupedDailyCrypto(date: string): Promise<Map<string, AggBar>> {
  const url = `${POLYGON_BASE}/v2/aggs/grouped/locale/global/market/crypto/${date}?adjusted=true`;
  const data = await fetchWithKey(url) as GroupedDailyResult;
  const map = new Map<string, AggBar>();
  for (const bar of data.results ?? []) {
    map.set(bar.T, bar);
  }
  return map;
}

/**
 * For weekly/monthly periods we also need the bar from N days ago.
 * We use the individual ticker aggregates endpoint for the start-of-period price
 * but only for the ~60 tickers we care about, making 2 bulk calls first then
 * filling in the "previous price" via a second grouped call on an older date.
 */
async function fetchGroupedDailyStocksForDate(date: string): Promise<Map<string, AggBar>> {
  try {
    return await fetchGroupedDailyStocks(date);
  } catch (err) {
    logger.warn({ date, err }, "Could not fetch grouped stocks for date");
    return new Map();
  }
}

async function fetchGroupedDailyCryptoForDate(date: string): Promise<Map<string, AggBar>> {
  try {
    return await fetchGroupedDailyCrypto(date);
  } catch (err) {
    logger.warn({ date, err }, "Could not fetch grouped crypto for date");
    return new Map();
  }
}

/** Returns the ISO date string for N trading days ago (skips weekends) */
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

/** Previous trading day date */
function prevTradingDay(): string {
  return tradingDaysAgo(1);
}

/** Date N trading days back for period start */
function periodStartDate(period: TimePeriod): string {
  switch (period) {
    case "1h":  return tradingDaysAgo(1);
    case "24h": return tradingDaysAgo(1);
    case "1w":  return tradingDaysAgo(5);
    case "1m":  return tradingDaysAgo(21);
  }
}

export async function fetchAllSecurities(period: TimePeriod): Promise<SecurityData[]> {
  const latestDate = prevTradingDay();
  const startDate = periodStartDate(period);

  logger.info({ period, latestDate, startDate }, "Fetching grouped daily data");

  // Two API calls: current day + period-start day (may be the same for 1h/24h)
  const isSameDate = latestDate === startDate;

  const [latestStocks, latestCrypto, startStocks, startCrypto] = await Promise.all([
    fetchGroupedDailyStocksForDate(latestDate),
    fetchGroupedDailyCryptoForDate(latestDate),
    isSameDate ? Promise.resolve(new Map<string, AggBar>()) : fetchGroupedDailyStocksForDate(startDate),
    isSameDate ? Promise.resolve(new Map<string, AggBar>()) : fetchGroupedDailyCryptoForDate(startDate),
  ]);

  const results: SecurityData[] = [];

  // Process equities
  for (const [ticker, meta] of Object.entries(EQUITY_META)) {
    const latest = latestStocks.get(ticker);
    if (!latest) continue;

    let previousPrice: number;
    if (isSameDate) {
      // For 1h/24h: use open price of that day as "previous"
      previousPrice = latest.o;
    } else {
      const startBar = startStocks.get(ticker);
      previousPrice = startBar ? startBar.c : latest.o;
    }

    if (!previousPrice || previousPrice === 0) continue;

    const currentPrice = latest.c;
    const percentChange = ((currentPrice - previousPrice) / previousPrice) * 100;

    results.push({
      ticker,
      name: meta.name,
      assetType: "equity",
      market: meta.market,
      currentPrice,
      previousPrice,
      percentChange,
      timePeriod: period,
      currency: meta.currency,
      volume: latest.v ?? null,
    });
  }

  // Process crypto
  for (const [polygonTicker, meta] of Object.entries(CRYPTO_META)) {
    const latest = latestCrypto.get(polygonTicker);
    if (!latest) continue;

    let previousPrice: number;
    if (isSameDate) {
      previousPrice = latest.o;
    } else {
      const startBar = startCrypto.get(polygonTicker);
      previousPrice = startBar ? startBar.c : latest.o;
    }

    if (!previousPrice || previousPrice === 0) continue;

    const currentPrice = latest.c;
    const percentChange = ((currentPrice - previousPrice) / previousPrice) * 100;
    const cleanTicker = polygonTicker.replace("X:", "").replace("USD", "");

    results.push({
      ticker: cleanTicker,
      name: meta.name,
      assetType: "crypto",
      market: "CRYPTO",
      currentPrice,
      previousPrice,
      percentChange,
      timePeriod: period,
      currency: "USD",
      volume: latest.v ?? null,
    });
  }

  logger.info({ period, count: results.length }, "Fetched securities");
  return results;
}

/** Returns the market classification for a tracked equity ticker, or null for unknowns/crypto */
export function getTickerMarket(ticker: string): Market | null {
  return EQUITY_META[ticker]?.market ?? null;
}

// ── News via Polygon ───────────────────────────────────────────────────────────

const NEWS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const NEWS_MAX_ARTICLES = 6;
const NEWS_LOOKBACK_DAYS = 7;

// Keywords that suggest a drop catalyst — each match adds to relevance score
const DROP_CATALYST_KEYWORDS = [
  "lawsuit", "sued", "fraud", "investigation", "probe", "sec", "doj",
  "class action", "securities", "downgrade", "cut", "miss", "misses",
  "warning", "recall", "layoff", "layoffs", "loss", "losses", "decline",
  "disappoints", "disappointing", "shortfall", "guidance", "lower",
  "subpoena", "fine", "penalty", "regulatory", "antitrust", "ban",
  "resign", "resignation", "fired", "departing",
];

export type NewsSentiment = "positive" | "negative" | "neutral";

export interface NewsArticle {
  headline: string;
  source: string;
  publishedAt: string; // ISO 8601
  url: string;
  sentiment: NewsSentiment;
  imageUrl?: string;
}

interface PolygonNewsInsight {
  ticker: string;
  sentiment: "positive" | "negative" | "neutral";
  sentiment_reasoning: string;
}

interface PolygonNewsArticle {
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  image_url?: string;
  description?: string;
  keywords?: string[];
  publisher: { name: string };
  insights?: PolygonNewsInsight[];
}

interface PolygonNewsResponse {
  results: PolygonNewsArticle[];
  status: string;
}

const newsCache = new Map<string, { data: NewsArticle[]; expiresAt: number }>();

function scoreArticle(article: PolygonNewsArticle, ticker: string, sentiment: NewsSentiment): number {
  let score = 0;

  // Sentiment weight
  if (sentiment === "negative") score += 4;
  else if (sentiment === "positive") score -= 1;

  // Recency boost — articles within last 48h
  const ageMs = Date.now() - new Date(article.published_utc).getTime();
  if (ageMs < 48 * 60 * 60 * 1000) score += 2;
  else if (ageMs < 24 * 60 * 60 * 1000 * 4) score += 1;

  // Keyword match in title + description
  const text = `${article.title} ${article.description ?? ""}`.toLowerCase();
  for (const kw of DROP_CATALYST_KEYWORDS) {
    if (text.includes(kw)) score += 2;
  }

  // Ticker explicitly mentioned in title
  if (article.title.toUpperCase().includes(ticker)) score += 1;

  return score;
}

export async function fetchTickerNewsPolygon(ticker: string): Promise<NewsArticle[]> {
  const cacheKey = `polygon-news:${ticker}`;
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    logger.warn("POLYGON_API_KEY not set — skipping Polygon news fetch");
    return [];
  }

  const from = new Date(Date.now() - NEWS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const url =
    `${POLYGON_BASE}/v2/reference/news` +
    `?ticker=${encodeURIComponent(ticker)}` +
    `&published_utc.gte=${from}` +
    `&limit=20` +
    `&sort=published_utc` +
    `&order=desc` +
    `&apiKey=${apiKey}`;

  let raw: PolygonNewsResponse | null = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      logger.warn({ status: res.status, ticker }, "Polygon news API error");
      return [];
    }
    raw = (await res.json()) as PolygonNewsResponse;
  } catch (err) {
    logger.warn({ ticker, err }, "Polygon news fetch failed");
    return [];
  }

  if (!Array.isArray(raw?.results)) return [];

  const scored = raw.results
    .filter((a) => a.title && a.article_url)
    .map((a) => {
      const insight = a.insights?.find((i) => i.ticker === ticker);
      const sentiment: NewsSentiment = insight?.sentiment ?? "neutral";
      return { article: a, sentiment, score: scoreArticle(a, ticker, sentiment) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, NEWS_MAX_ARTICLES);

  const articles: NewsArticle[] = scored.map(({ article, sentiment }) => ({
    headline: article.title,
    source: article.publisher?.name ?? "",
    publishedAt: article.published_utc,
    url: article.article_url,
    sentiment,
    imageUrl: article.image_url,
  }));

  newsCache.set(cacheKey, { data: articles, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
  return articles;
}

export function getDropRange(percentChange: number): DropRange {
  const abs = Math.abs(percentChange);
  if (abs <= 10) return "up_to_10";
  if (abs <= 20) return "11_to_20";
  if (abs <= 30) return "21_to_30";
  return "31_plus";
}
