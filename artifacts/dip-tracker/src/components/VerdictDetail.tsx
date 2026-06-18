import React from "react";
import type {
  TickerVerdict,
  MultipleResult,
  CheapnessResult,
  FundamentalsResult,
  EstimateRevisions,
  RoicResult,
  DeResult,
  PriceTarget,
  NewsArticle,
} from "@workspace/api-client-react";
import { useGetTickerNews } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBadge } from "./VerdictBadge";
import { WhyItDropped } from "./WhyItDropped";

// ── Multiple row ──────────────────────────────────────────────────────────────

const TAG_STYLES: Record<string, string> = {
  cheap:     "text-emerald-400",
  fair:      "text-muted-foreground",
  expensive: "text-red-400",
  missing:   "text-muted-foreground/40",
};

const TAG_LABELS: Record<string, string> = {
  cheap: "Cheap",
  fair: "Fair",
  expensive: "Expensive",
  missing: "N/A",
};

function MultipleRow({
  label,
  result,
}: {
  label: string;
  result: MultipleResult;
}) {
  const tagStyle = TAG_STYLES[result.tag] ?? TAG_STYLES.missing;
  const tagLabel = TAG_LABELS[result.tag] ?? "N/A";

  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-muted-foreground text-xs w-20 shrink-0">{label}</span>
      <span className="font-mono text-xs text-foreground">
        {result.value != null ? `${result.value.toFixed(1)}×` : "—"}
      </span>
      <span className="text-muted-foreground/50 text-xs">
        vs {result.sectorMedian.toFixed(1)}×
      </span>
      <span className={`text-xs font-semibold ${tagStyle}`}>{tagLabel}</span>
    </div>
  );
}

// ── Cheapness section ─────────────────────────────────────────────────────────

function CheapnessSection({ data }: { data: CheapnessResult }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cheapness</span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            data.label === "Cheap"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-muted/40 text-muted-foreground"
          }`}
        >
          {data.label}
        </span>
        {data.isUnprofitable && (
          <span className="text-[10px] text-amber-500/70 bg-amber-500/10 px-1.5 py-0.5 rounded">
            Unprofitable
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {!data.isUnprofitable && (
          <MultipleRow label="P/E" result={data.pe} />
        )}
        <MultipleRow label="P/S" result={data.ps} />
      </div>
      <p className="text-[10px] text-muted-foreground/40 mt-2">
        Sector medians from Finnhub industry classification
      </p>
    </div>
  );
}

// ── Fundamentals section ──────────────────────────────────────────────────────

function RevisionRow({ revisions }: { revisions: EstimateRevisions }) {
  if (!revisions.available) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-muted-foreground text-xs w-32 shrink-0">EPS Revisions</span>
        <span className="text-muted-foreground/50 text-xs italic">unavailable</span>
      </div>
    );
  }
  const dir = revisions.direction;
  const positive = dir === "up";
  const neutral = dir === "flat";
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-muted-foreground text-xs w-32 shrink-0">EPS Revisions</span>
      {neutral ? (
        <span className="text-muted-foreground text-xs">→ Flat</span>
      ) : (
        <span className={`text-xs font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {positive ? "↑ Rising" : "↓ Falling"}
        </span>
      )}
    </div>
  );
}

function FundamentalsSection({ data }: { data: FundamentalsResult }) {
  const revGrowth = data.revenueGrowthYoy;
  const grossMargin = data.grossMarginTtm;

  const growthPositive = revGrowth !== null && revGrowth > 5;
  const growthNegative = revGrowth !== null && revGrowth < -5;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fundamentals</span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            data.label === "Stable/Improving"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {data.label}
        </span>
      </div>
      <div className="space-y-0.5">
        <RevisionRow revisions={data.estimateRevisions} />

        <div className="flex items-center gap-2 py-0.5">
          <span className="text-muted-foreground text-xs w-32 shrink-0">Revenue Growth</span>
          {revGrowth !== null ? (
            <span className={`text-xs font-semibold ${growthPositive ? "text-emerald-400" : growthNegative ? "text-red-400" : "text-muted-foreground"}`}>
              {growthPositive ? "↑" : growthNegative ? "↓" : "→"}{" "}
              {revGrowth >= 0 ? "+" : ""}{revGrowth.toFixed(1)}% YoY
            </span>
          ) : (
            <span className="text-muted-foreground/50 text-xs italic">unavailable</span>
          )}
        </div>

        <div className="flex items-center gap-2 py-0.5">
          <span className="text-muted-foreground text-xs w-32 shrink-0">Gross Margin</span>
          {grossMargin !== null ? (
            <span className={`text-xs font-mono ${grossMargin > 30 ? "text-emerald-400" : "text-muted-foreground"}`}>
              {grossMargin.toFixed(1)}%
            </span>
          ) : (
            <span className="text-muted-foreground/50 text-xs italic">unavailable</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ROIC section ──────────────────────────────────────────────────────────────

const ROIC_FLAG_STYLES: Record<string, { bar: string; text: string; label: string }> = {
  elite:           { bar: "bg-emerald-400",      text: "text-emerald-300",       label: "Elite" },
  high:            { bar: "bg-emerald-500",      text: "text-emerald-400",       label: "Strong" },
  value_creating:  { bar: "bg-emerald-500/60",   text: "text-emerald-400/80",    label: "Value-Creating" },
  marginal:        { bar: "bg-slate-500",        text: "text-muted-foreground",  label: "Marginal" },
  value_destroying:{ bar: "bg-red-500",          text: "text-red-400",           label: "Value-Destroying" },
  skipped:         { bar: "bg-slate-700",        text: "text-muted-foreground/50", label: "N/A" },
  missing:         { bar: "bg-slate-700",        text: "text-muted-foreground/50", label: "Unavailable" },
};

function RoicSection({ data, verdictShifted, verdictBase, verdictAfterRoic }: {
  data: RoicResult;
  verdictShifted: boolean;
  verdictBase?: string | null;
  verdictAfterRoic?: string | null;
}) {
  const style = ROIC_FLAG_STYLES[data.flag] ?? ROIC_FLAG_STYLES.missing;
  const pct = data.value != null ? `${Math.round(data.value * 100)}%` : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quality (ROIC)</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted/30 ${style.text}`}>
          {style.label}
        </span>
      </div>

      <div className="space-y-1.5">
        {/* ROIC value + mini bar */}
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-muted-foreground text-xs w-16 shrink-0">ROIC TTM</span>
          {pct !== null ? (
            <span className={`font-mono text-xs font-semibold ${style.text}`}>{pct}</span>
          ) : (
            <span className="text-muted-foreground/50 text-xs italic">—</span>
          )}
        </div>

        {/* Colour-coded bar only when value is present */}
        {pct !== null && data.value != null && (
          <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${style.bar}`}
              style={{ width: `${Math.min(100, Math.abs(data.value!) * 100 / 0.25 * 100)}%` }}
            />
          </div>
        )}

        {/* One-line interpretation */}
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-0.5">
          {data.note}
        </p>

        {/* Override rationale — shows whenever the modifier ran (shifted or not) */}
        {data.overrideRationale && (
          <p className={`text-[10px] rounded px-2 py-1.5 leading-relaxed border ${
            verdictShifted
              ? "text-sky-400/90 bg-sky-500/10 border-sky-500/20"
              : "text-muted-foreground/60 bg-muted/20 border-border/30"
          }`}>
            {data.overrideRationale}
          </p>
        )}
        {/* Fallback shift indicator when no rationale (backward compat) */}
        {!data.overrideRationale && verdictShifted && verdictBase && verdictAfterRoic && (
          <p className="text-[10px] text-sky-400/80 bg-sky-500/10 border border-sky-500/20 rounded px-2 py-1 leading-relaxed">
            ROIC shifted verdict: "{verdictBase}" → "{verdictAfterRoic}"
          </p>
        )}
      </div>
    </div>
  );
}

// ── D/E (Leverage) section ────────────────────────────────────────────────────

const DE_FLAG_STYLES: Record<string, { dot: string; text: string; label: string; tagColor: string }> = {
  normal:    { dot: "bg-emerald-500",  text: "text-emerald-400",          label: "Normal",     tagColor: "bg-emerald-500/15 text-emerald-400" },
  elevated:  { dot: "bg-amber-400",   text: "text-amber-400",            label: "Elevated",   tagColor: "bg-amber-500/15 text-amber-400" },
  high:      { dot: "bg-red-500",     text: "text-red-400",              label: "High",       tagColor: "bg-red-500/15 text-red-400" },
  distressed:{ dot: "bg-red-600",     text: "text-red-400",              label: "Distressed", tagColor: "bg-red-600/20 text-red-400" },
  skipped:   { dot: "bg-slate-600",   text: "text-muted-foreground/50",  label: "N/A",        tagColor: "bg-muted/30 text-muted-foreground/50" },
  missing:   { dot: "bg-slate-700",   text: "text-muted-foreground/50",  label: "Unavailable",tagColor: "bg-muted/20 text-muted-foreground/40" },
};

function DeSection({ data, verdictShifted, verdictBeforeDe, verdict }: {
  data: DeResult;
  verdictShifted: boolean;
  verdictBeforeDe?: string | null;
  verdict?: string | null;
}) {
  const style = DE_FLAG_STYLES[data.flag] ?? DE_FLAG_STYLES.missing;
  const deVal = data.value != null ? `${data.value.toFixed(2)}×` : null;
  const isNegative = data.flag === "distressed";
  const isHigh = data.flag === "high";

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leverage (D/E)</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.tagColor}`}>
          {style.label}
        </span>
      </div>

      <div className="space-y-1.5">
        {/* D/E value row */}
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-muted-foreground text-xs w-16 shrink-0">D/E Ratio</span>
          {deVal !== null ? (
            <span className={`font-mono text-xs font-semibold ${style.text}`}>{deVal}</span>
          ) : (
            <span className="text-muted-foreground/50 text-xs italic">—</span>
          )}
        </div>

        {/* Sector band */}
        {data.sectorBand && (
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-muted-foreground text-xs w-16 shrink-0">Sector norm</span>
            <span className="text-xs text-muted-foreground/60 font-mono">
              ≤{data.sectorBand.elevated}× normal / ≤{data.sectorBand.high}× elevated
            </span>
          </div>
        )}

        {/* Prominent tag for high/distressed */}
        {data.tag && (isHigh || isNegative) && (
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${
            isNegative ? "bg-red-600/20 text-red-400 border border-red-600/30" : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
          }`}>
            {data.tag}
          </span>
        )}

        {/* Debt-free tag */}
        {data.tag && data.flag === "normal" && data.value === 0 && (
          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            {data.tag}
          </span>
        )}

        {/* One-line interpretation */}
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-0.5">
          {data.note}
        </p>

        {/* Shift indicator */}
        {verdictShifted && verdictBeforeDe && verdict && (
          <p className={`text-[10px] rounded px-2 py-1 leading-relaxed border ${
            isNegative
              ? "text-red-400/80 bg-red-500/10 border-red-500/20"
              : "text-amber-400/80 bg-amber-500/10 border-amber-500/20"
          }`}>
            D/E {isNegative ? "capped" : "shifted"} verdict: "{verdictBeforeDe}" → "{verdict}"
          </p>
        )}
      </div>
    </div>
  );
}

// ── News section ──────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SENTIMENT_STYLES: Record<string, { dot: string; label: string; labelCls: string }> = {
  negative: { dot: "bg-red-500",    label: "Negative", labelCls: "text-red-400" },
  positive: { dot: "bg-emerald-500", label: "Positive", labelCls: "text-emerald-400" },
  neutral:  { dot: "bg-muted-foreground/40", label: "Neutral", labelCls: "text-muted-foreground/50" },
};

function NewsArticleRow({ article }: { article: NewsArticle }) {
  const sentiment = article.sentiment ?? "neutral";
  const s = SENTIMENT_STYLES[sentiment] ?? SENTIMENT_STYLES.neutral;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
      <div className="flex-shrink-0 mt-1">
        <span
          className={`block w-2 h-2 rounded-full ${s.dot}`}
          title={s.label}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs text-foreground/90 leading-snug line-clamp-2">{article.headline}</p>
        <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
          <span>{article.source}</span>
          <span>·</span>
          <span>{timeAgo(article.publishedAt)}</span>
          <span className={`font-semibold ${s.labelCls}`}>· {s.label}</span>
        </p>
      </div>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 mt-0.5 text-[10px] font-medium text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-400/50 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap"
        aria-label={`Open article: ${article.headline}`}
      >
        ↗ Open
      </a>
    </div>
  );
}

function NewsSection({ ticker }: { ticker: string }) {
  const { data, isLoading } = useGetTickerNews(ticker);
  const articles = data?.articles ?? [];

  const negCount = articles.filter((a) => a.sentiment === "negative").length;

  return (
    <div className="pt-3 border-t border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Recent News
        </span>
        {negCount > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
            {negCount} negative
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full bg-muted/20" />
          ))}
        </div>
      )}

      {!isLoading && articles.length === 0 && (
        <p className="text-xs text-muted-foreground/40 italic">No recent news in the last 7 days.</p>
      )}

      {!isLoading && articles.length > 0 && (
        <div>
          {articles.map((article) => (
            <NewsArticleRow key={article.url} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Price target section ──────────────────────────────────────────────────────

function PriceTargetSection({
  priceTarget,
  currentPrice,
}: {
  priceTarget: PriceTarget | null | undefined;
  currentPrice: number | undefined;
}) {
  const upside =
    priceTarget && currentPrice && currentPrice > 0
      ? ((priceTarget.targetMedian - currentPrice) / currentPrice) * 100
      : null;

  const upsideColor =
    upside === null
      ? "text-muted-foreground"
      : upside > 5
      ? "text-emerald-400"
      : upside < -5
      ? "text-red-400"
      : "text-amber-400";

  const upsideLabel =
    upside === null ? null : `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Price Target
        </span>
      </div>

      {!priceTarget ? (
        <p className="text-xs text-muted-foreground/50 italic">No analyst targets</p>
      ) : (
        <div className="space-y-1.5">
          {/* Median + upside */}
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-base font-bold text-foreground">
              ${priceTarget.targetMedian.toFixed(2)}
            </span>
            {upsideLabel && (
              <span className={`text-xs font-semibold ${upsideColor}`}>
                {upsideLabel} upside
              </span>
            )}
          </div>

          {/* High / Low range */}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <span>Range</span>
            <span className="font-mono">${priceTarget.targetLow.toFixed(2)}</span>
            <span>–</span>
            <span className="font-mono">${priceTarget.targetHigh.toFixed(2)}</span>
          </div>

          {/* Updated date */}
          {priceTarget.lastUpdated && (
            <p className="text-[10px] text-muted-foreground/40">
              Updated {priceTarget.lastUpdated.slice(0, 10)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Analyst section ───────────────────────────────────────────────────────────

function AnalystsSection({
  analysts,
}: {
  analysts: { buy: number; hold: number; sell: number; consensus: string } | null | undefined;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Analysts</span>
        {analysts && (
          <span className="text-[10px] font-bold text-foreground/80 bg-muted/30 px-1.5 py-0.5 rounded">
            {analysts.consensus}
          </span>
        )}
      </div>
      {!analysts ? (
        <p className="text-xs text-muted-foreground/50 italic">No coverage data</p>
      ) : (
        <div className="space-y-1">
          {[
            { label: "Buy", count: analysts.buy, color: "bg-emerald-500" },
            { label: "Hold", count: analysts.hold, color: "bg-slate-500" },
            { label: "Sell", count: analysts.sell, color: "bg-red-500" },
          ].map(({ label, count, color }) => {
            const total = analysts.buy + analysts.hold + analysts.sell;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs w-6">{label}</span>
                <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface VerdictDetailProps {
  ticker: string;
  data: TickerVerdict | null | undefined;
  loading: boolean;
  currentPrice?: number;
  period?: string;
}

export function VerdictDetail({ ticker, data, loading, currentPrice, period = "24h" }: VerdictDetailProps) {
  if (loading) {
    return (
      <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24 bg-muted/30" />
            {[...Array(3)].map((_, j) => (
              <Skeleton key={j} className="h-3 w-full bg-muted/20" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-sm text-muted-foreground/50 italic">
        Fundamental data unavailable for {ticker}. This ticker may not be covered by Finnhub's free tier.
      </div>
    );
  }

  // ROIC shifted: verdictBase → verdictAfterRoic (ROIC modifier only)
  const roicShifted = !!(
    data.roic && data.verdictBase && data.verdictAfterRoic &&
    data.verdictBase !== data.verdictAfterRoic
  );
  // D/E shifted: verdictAfterRoic → verdict (D/E modifier only)
  const deShifted = !!(
    data.de && data.verdictAfterRoic && data.verdict &&
    data.verdictAfterRoic !== data.verdict
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <VerdictBadge verdict={data.verdict ?? null} size="md" />
        <p className="text-sm text-muted-foreground leading-relaxed">{data.explanation}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-x-8 gap-y-4 pt-2 border-t border-border/50">
        <CheapnessSection data={data.cheapness} />
        <FundamentalsSection data={data.fundamentals} />
        {data.roic && (
          <RoicSection
            data={data.roic}
            verdictShifted={roicShifted}
            verdictBase={data.verdictBase}
            verdictAfterRoic={data.verdictAfterRoic}
          />
        )}
        {data.de && (
          <DeSection
            data={data.de}
            verdictShifted={deShifted}
            verdictBeforeDe={data.verdictAfterRoic}
            verdict={data.verdict}
          />
        )}
        <PriceTargetSection priceTarget={data.priceTarget} currentPrice={currentPrice} />
        <AnalystsSection analysts={data.analysts} />
      </div>

      {data.missingData.length > 0 && (
        <p className="text-[10px] text-muted-foreground/40 italic pt-1 border-t border-border/30">
          Data unavailable: {data.missingData.join(", ")}
        </p>
      )}

      {/* Why It Dropped — before the news feed */}
      <div className="pt-2 border-t border-border/30">
        <WhyItDropped ticker={ticker} period={period} />
      </div>

      <NewsSection ticker={ticker} />
    </div>
  );
}
