import { Router } from "express";
import { z } from "zod";
import { classifyDrop } from "../lib/drop-classifier";
import { fetchFinnhubValuation } from "../lib/finnhub";
import { getSecuritiesForPeriod } from "../lib/cache";
import { getTickerMarket } from "../lib/polygon";

const router = Router();

const TimePeriodSchema = z.enum(["1h", "24h", "1w", "1m"]);

router.get("/drop-cause", async (req, res) => {
  const rawTicker = req.query["ticker"];
  const rawPeriod = req.query["period"] ?? "24h";

  if (typeof rawTicker !== "string" || rawTicker.trim() === "") {
    res.status(400).json({ error: "ticker query parameter is required" });
    return;
  }

  const ticker = rawTicker.trim().toUpperCase();

  const periodResult = TimePeriodSchema.safeParse(rawPeriod);
  if (!periodResult.success) {
    res.status(400).json({ error: "period must be one of: 1h, 24h, 1w, 1m" });
    return;
  }
  const period = periodResult.data;

  try {
    // Look up the ticker's return from the 15-min securities cache (cheap — already warm)
    const securities = await getSecuritiesForPeriod(period);
    const secData = securities.find((s) => s.ticker === ticker);
    const stockReturn = secData?.percentChange ?? null;

    // Market classification from polygon metadata (O(1))
    const market = getTickerMarket(ticker);

    // Finnhub sector — cached per ticker for 1h
    const valuation = await fetchFinnhubValuation(ticker).catch(() => null);
    const finnhubSector = valuation?.sector ?? null;

    const classification = await classifyDrop({
      ticker,
      period,
      stockReturn,
      finnhubSector,
      market,
    });

    res.json(classification);
  } catch (err) {
    req.log.error({ err, ticker, period }, "drop-cause route error");
    res.status(500).json({ error: "Failed to classify drop" });
  }
});

export default router;
