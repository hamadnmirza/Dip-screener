import { Router, type IRouter } from "express";
import { fetchFinnhubValuation, fetchFinnhubRecommendations, fetchEstimateRevisions } from "../lib/finnhub";
import { fetchFmpRoic } from "../lib/fmp";
import {
  scoreCheapness,
  scoreFundamentals,
  computeVerdict,
  computeRoicFlag,
  applyRoicModifier,
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

  const entries = await Promise.all(tickers.map((ticker) => computeTickerVerdict(ticker)));

  const verdicts: Record<string, VerdictResult | null> = {};
  for (let i = 0; i < tickers.length; i++) {
    verdicts[tickers[i]] = entries[i];
  }

  res.json({ verdicts });
});

async function computeTickerVerdict(ticker: string): Promise<VerdictResult | null> {
  try {
    const [valuation, analystData, revisions, fmpRoic] = await Promise.all([
      fetchFinnhubValuation(ticker),
      fetchFinnhubRecommendations(ticker),
      fetchEstimateRevisions(ticker),
      fetchFmpRoic(ticker),
    ]);

    if (!valuation) return null;

    const cheapness = scoreCheapness({
      sector: valuation.sector,
      pe: valuation.pe,
      ps: valuation.ps,
      isUnprofitable: valuation.isUnprofitable,
    });

    const fundamentals = scoreFundamentals({
      estimateRevisions: revisions,
      revenueGrowthYoy: valuation.revenueGrowthYoy,
      grossMarginTtm: valuation.grossMarginTtm,
    }) as FundamentalsResult & { _noSignals?: boolean };

    // Base verdict from cheapness alone
    const verdictBase = computeVerdict(cheapness, fundamentals);

    // ROIC quality modifier
    const roic = computeRoicFlag(fmpRoic?.roicTTM ?? null, valuation.sector);
    const roicMod = verdictBase !== null
      ? applyRoicModifier(verdictBase, roic)
      : { verdict: verdictBase as never, shifted: false };

    const verdict = verdictBase !== null
      ? roicMod.verdict
      : null;

    const analysts = analystData
      ? {
          buy: analystData.buy,
          hold: analystData.hold,
          sell: analystData.sell,
          consensus: computeAnalystConsensus(analystData.buy, analystData.hold, analystData.sell),
        }
      : null;

    const explanation = generateExplanation(
      ticker,
      cheapness,
      fundamentals,
      verdict,
      roicMod.shifted
        ? { roic, modification: roicMod, baseVerdict: verdictBase }
        : undefined
    );

    const allMissing = [...cheapness.missingData, ...fundamentals.missingData];

    return {
      ticker,
      verdict,
      verdictBase,
      cheapness,
      fundamentals,
      analysts,
      roic,
      explanation,
      missingData: allMissing,
    };
  } catch {
    return null;
  }
}

export default router;
