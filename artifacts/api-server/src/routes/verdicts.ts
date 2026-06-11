import { Router, type IRouter } from "express";
import { fetchFmpValuation, fetchFmpQuarterly } from "../lib/fmp";
import { fetchFinnhubRecommendations, fetchEstimateRevisions } from "../lib/finnhub";
import {
  scoreCheapness,
  scoreFundamentals,
  computeVerdict,
  generateExplanation,
  computeAnalystConsensus,
  type VerdictResult,
  type FundamentalsResult,
} from "../lib/scoring";

const router: IRouter = Router();

const MAX_TICKERS = 30;

router.get("/verdicts", async (req, res) => {
  const raw = req.query.tickers;
  if (!raw || typeof raw !== "string") {
    res.status(400).json({ error: "Missing required query param: tickers" });
    return;
  }

  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_TICKERS);

  if (tickers.length === 0) {
    res.json({ verdicts: {} });
    return;
  }

  // Fetch all tickers concurrently — errors per ticker are handled individually
  const entries = await Promise.all(tickers.map((ticker) => computeTickerVerdict(ticker)));

  const verdicts: Record<string, VerdictResult | null> = {};
  for (let i = 0; i < tickers.length; i++) {
    verdicts[tickers[i]] = entries[i];
  }

  res.json({ verdicts });
});

async function computeTickerVerdict(ticker: string): Promise<VerdictResult | null> {
  try {
    const [valuation, quarterly, analystData, revisions] = await Promise.all([
      fetchFmpValuation(ticker),
      fetchFmpQuarterly(ticker),
      fetchFinnhubRecommendations(ticker),
      fetchEstimateRevisions(ticker),
    ]);

    if (!valuation) return null;

    const cheapness = scoreCheapness({
      sector: valuation.sector,
      pe: valuation.pe,
      evEbitda: valuation.evEbitda,
      pFcf: valuation.pFcf,
      peg: valuation.peg,
      evRevenue: valuation.evRevenue,
      isUnprofitable: valuation.isUnprofitable,
    });

    const fundamentals = scoreFundamentals({
      estimateRevisions: revisions,
      quarterlyRevenue: quarterly?.revenue ?? [],
      quarterlyGrossMargin: quarterly?.grossMargin ?? [],
      debtToEbitda: valuation.debtToEbitda,
      fcfTtm: valuation.fcfTtm,
    }) as FundamentalsResult & { _noSignals?: boolean };

    const verdict = computeVerdict(cheapness, fundamentals);

    const analysts = analystData
      ? {
          buy: analystData.buy,
          hold: analystData.hold,
          sell: analystData.sell,
          consensus: computeAnalystConsensus(analystData.buy, analystData.hold, analystData.sell),
        }
      : null;

    const explanation = generateExplanation(ticker, cheapness, fundamentals, verdict);

    const allMissing = [...cheapness.missingData, ...fundamentals.missingData];

    return {
      ticker,
      verdict,
      cheapness,
      fundamentals,
      analysts,
      explanation,
      missingData: allMissing,
    };
  } catch (err) {
    // Per-ticker errors return null rather than breaking the batch
    return null;
  }
}

export default router;
