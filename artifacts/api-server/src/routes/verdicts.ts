import { Router, type IRouter } from "express";
import { fetchFinnhubValuation, fetchFinnhubRecommendations, fetchEstimateRevisions } from "../lib/finnhub";
import { fetchPriceTarget } from "../lib/fmp";
import {
  scoreCheapness,
  scoreFundamentals,
  computeVerdict,
  computeRoicFlag,
  applyRoicModifier,
  computeDeFlag,
  applyDeModifier,
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
    const [valuation, analystData, revisions, priceTargetData] = await Promise.all([
      fetchFinnhubValuation(ticker),
      fetchFinnhubRecommendations(ticker),
      fetchEstimateRevisions(ticker),
      fetchPriceTarget(ticker),
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

    // D/E leverage (compute before ROIC modifier — D/E is passed to applyRoicModifier
    // so the leverage gate is applied inside the ROIC step, not separately).
    const de = computeDeFlag(valuation.deRatio, valuation.sector);

    // ROIC quality modifier — tiered + leverage-aware.
    // roiTtm from Finnhub is percent form (e.g. 26.33 = 26.33%), convert to decimal.
    const roicDecimal = valuation.roiTtm !== null ? valuation.roiTtm / 100 : null;
    const roic = computeRoicFlag(roicDecimal, valuation.sector);
    const roicMod = verdictBase !== null
      ? applyRoicModifier(verdictBase, roic, de)
      : { verdict: verdictBase as never, shifted: false };

    // Attach the override rationale to the roic result for the frontend
    if (roicMod.rationale) {
      roic.overrideRationale = roicMod.rationale;
    }

    const verdictAfterRoic = verdictBase !== null ? roicMod.verdict : null;

    // D/E leverage modifier — runs AFTER ROIC.
    // debtToEbitda: not available from Finnhub metric call; pass null → elevated gate skipped.
    const deMod = verdictAfterRoic !== null
      ? applyDeModifier(verdictAfterRoic, de, null)
      : { verdict: verdictAfterRoic as never, shifted: false };

    const verdict = verdictAfterRoic !== null ? deMod.verdict : null;

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
        : undefined,
      deMod.shifted
        ? { de, modification: deMod, verdictBeforeDe: verdictAfterRoic }
        : undefined
    );

    const allMissing = [...cheapness.missingData, ...fundamentals.missingData];

    return {
      ticker,
      verdict,
      verdictBase,
      verdictAfterRoic,
      cheapness,
      fundamentals,
      analysts,
      roic,
      de,
      priceTarget: priceTargetData,
      explanation,
      missingData: allMissing,
    };
  } catch {
    return null;
  }
}

export default router;
