import { Router, type IRouter } from "express";
import { getSecuritiesForPeriod, getOverallLastUpdated } from "../lib/cache";
import { getDropRange, type TimePeriod, type AssetType, type Market, type DropRange } from "../lib/polygon";

const router: IRouter = Router();

const VALID_PERIODS: TimePeriod[] = ["1h", "24h", "1w", "1m"];
const VALID_ASSET_TYPES: AssetType[] = ["equity", "crypto"];
const VALID_MARKETS: Market[] = ["NASDAQ", "FTSE100", "FTSE250", "SP500"];
const VALID_DROP_RANGES: DropRange[] = ["up_to_10", "11_to_20", "21_to_30", "31_plus"];

function parsePeriod(val: unknown): TimePeriod {
  if (typeof val === "string" && VALID_PERIODS.includes(val as TimePeriod)) {
    return val as TimePeriod;
  }
  return "24h";
}

router.get("/securities/by-tickers", async (req, res) => {
  try {
    const raw = req.query.tickers;
    if (!raw || typeof raw !== "string") {
      res.status(400).json({ error: "tickers query param is required" });
      return;
    }
    const requested = raw
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 50);

    if (requested.length === 0) {
      res.status(400).json({ error: "No valid tickers provided" });
      return;
    }

    const all = await getSecuritiesForPeriod("24h");
    const tickerSet = new Set(requested);
    const matched = all.filter((s) => tickerSet.has(s.ticker));

    const { timestamp, nextRefreshAt } = getOverallLastUpdated();

    res.json({
      securities: matched,
      total: matched.length,
      lastUpdated: timestamp?.toISOString() ?? new Date().toISOString(),
      nextRefreshAt: nextRefreshAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching securities by tickers");
    res.status(500).json({ error: "Failed to fetch securities data" });
  }
});

router.get("/securities", async (req, res) => {
  try {
    const period = parsePeriod(req.query.timePeriod);
    const assetType = req.query.assetType as AssetType | undefined;
    const market = req.query.market as Market | undefined;
    const dropRange = req.query.dropRange as DropRange | undefined;

    const all = await getSecuritiesForPeriod(period);

    let filtered = all.filter((s) => s.percentChange < 0);

    if (assetType && VALID_ASSET_TYPES.includes(assetType)) {
      filtered = filtered.filter((s) => s.assetType === assetType);
    }

    if (market && VALID_MARKETS.includes(market)) {
      filtered = filtered.filter((s) => s.market === market);
    }

    if (dropRange && VALID_DROP_RANGES.includes(dropRange)) {
      filtered = filtered.filter((s) => getDropRange(s.percentChange) === dropRange);
    }

    // Sort by biggest drop first
    filtered.sort((a, b) => a.percentChange - b.percentChange);

    const { timestamp, nextRefreshAt } = getOverallLastUpdated();

    res.json({
      securities: filtered,
      total: filtered.length,
      lastUpdated: timestamp?.toISOString() ?? new Date().toISOString(),
      nextRefreshAt: nextRefreshAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching securities");
    res.status(500).json({ error: "Failed to fetch securities data" });
  }
});

router.get("/securities/summary", async (req, res) => {
  try {
    const period = parsePeriod(req.query.timePeriod);
    const all = await getSecuritiesForPeriod(period);
    const falling = all.filter((s) => s.percentChange < 0);

    const byDropRange: Record<DropRange, number> = {
      up_to_10: 0,
      "11_to_20": 0,
      "21_to_30": 0,
      "31_plus": 0,
    };
    const byAssetType = { equity: 0, crypto: 0 };
    const byMarket = { NASDAQ: 0, FTSE100: 0, FTSE250: 0, SP500: 0, CRYPTO: 0 };

    for (const s of falling) {
      const range = getDropRange(s.percentChange);
      byDropRange[range]++;
      byAssetType[s.assetType]++;
      if (s.market in byMarket) {
        byMarket[s.market as keyof typeof byMarket]++;
      }
    }

    const { timestamp, nextRefreshAt } = getOverallLastUpdated();

    res.json({
      totalFalling: falling.length,
      byDropRange: Object.entries(byDropRange).map(([range, count]) => ({ range, count })),
      byAssetType,
      byMarket,
      timePeriod: period,
      lastUpdated: timestamp?.toISOString() ?? new Date().toISOString(),
      nextRefreshAt: nextRefreshAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching securities summary");
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

router.get("/securities/top-movers", async (req, res) => {
  try {
    const period = parsePeriod(req.query.timePeriod);
    const assetType = req.query.assetType as AssetType | undefined;

    const all = await getSecuritiesForPeriod(period);
    let falling = all.filter((s) => s.percentChange < 0);

    if (assetType && VALID_ASSET_TYPES.includes(assetType)) {
      falling = falling.filter((s) => s.assetType === assetType);
    }

    falling.sort((a, b) => a.percentChange - b.percentChange);
    const top10 = falling.slice(0, 10);

    const { timestamp } = getOverallLastUpdated();

    res.json({
      movers: top10,
      timePeriod: period,
      lastUpdated: timestamp?.toISOString() ?? new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching top movers");
    res.status(500).json({ error: "Failed to fetch top movers" });
  }
});

router.get("/securities/last-updated", async (_req, res) => {
  const { timestamp, nextRefreshAt } = getOverallLastUpdated();
  const now = new Date();
  const nextRefreshIn = nextRefreshAt
    ? Math.max(0, Math.floor((nextRefreshAt.getTime() - now.getTime()) / 1000))
    : 900;

  res.json({
    timestamp: timestamp?.toISOString() ?? null,
    nextRefreshIn,
  });
});

export default router;
