import React from "react";
import type {
  TickerVerdict,
  MultipleResult,
  CheapnessResult,
  FundamentalsResult,
  EstimateRevisions,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBadge } from "./VerdictBadge";

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  const v = values.filter((x) => x > 0);
  if (v.length < 2) return <span className="text-muted-foreground/50 text-xs">—</span>;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const range = max - min || 1;
  const W = 52, H = 18;
  const pts = v
    .map((val, i) => {
      const x = (i / (v.length - 1)) * W;
      const y = H - ((val - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const trend = v[v.length - 1] >= v[0];
  return (
    <svg width={W} height={H} className="inline-block align-middle">
      <polyline
        points={pts}
        fill="none"
        stroke={trend ? "rgb(52 211 153)" : "rgb(248 113 113)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  medianLabel,
}: {
  label: string;
  result: MultipleResult;
  medianLabel?: string;
}) {
  const tagStyle = TAG_STYLES[result.tag] ?? TAG_STYLES.missing;
  const tagLabel = TAG_LABELS[result.tag] ?? "N/A";

  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-muted-foreground text-xs w-24 shrink-0">{label}</span>
      <span className="font-mono text-xs text-foreground">
        {result.value != null ? result.value.toFixed(1) : "—"}
      </span>
      <span className="text-muted-foreground/50 text-xs">
        vs {result.sectorMedian.toFixed(1)}{medianLabel ? ` ${medianLabel}` : ""}
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
          <>
            <MultipleRow label="P/E" result={data.pe} medianLabel="median" />
            <MultipleRow label="EV/EBITDA" result={data.evEbitda} medianLabel="median" />
            <MultipleRow label="P/FCF" result={data.pFcf} medianLabel="median" />
          </>
        )}
        {data.peg && (
          <MultipleRow label="PEG" result={data.peg} medianLabel="threshold" />
        )}
        {data.isUnprofitable && data.evRevenue && (
          <MultipleRow label="EV/Revenue" result={data.evRevenue} medianLabel="median" />
        )}
      </div>
    </div>
  );
}

// ── Fundamentals section ──────────────────────────────────────────────────────

function DirectionArrow({ positive }: { positive: boolean }) {
  return positive ? (
    <span className="text-emerald-400 font-bold">↑</span>
  ) : (
    <span className="text-red-400 font-bold">↓</span>
  );
}

function RevisionRow({ revisions }: { revisions: EstimateRevisions }) {
  if (!revisions.available) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-muted-foreground text-xs w-28 shrink-0">Est. Revisions</span>
        <span className="text-muted-foreground/50 text-xs italic">unavailable on free tier</span>
      </div>
    );
  }
  const dir = revisions.direction;
  const positive = dir === "up";
  const neutral = dir === "flat";
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-muted-foreground text-xs w-28 shrink-0">Est. Revisions</span>
      {neutral ? (
        <span className="text-muted-foreground text-xs">→ Flat</span>
      ) : (
        <span className={`text-xs font-semibold flex items-center gap-1 ${positive ? "text-emerald-400" : "text-red-400"}`}>
          <DirectionArrow positive={positive} />
          {positive ? "Rising" : "Falling"}
        </span>
      )}
    </div>
  );
}

function FundamentalsSection({ data }: { data: FundamentalsResult }) {
  const revPos = data.revenueTrend.direction === "growing";
  const revNeg = data.revenueTrend.direction === "shrinking" || data.revenueTrend.direction === "decelerating";
  const marPos = data.marginTrend.direction === "stable" || data.marginTrend.direction === "expanding";

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
          <span className="text-muted-foreground text-xs w-28 shrink-0">Revenue Trend</span>
          <Sparkline values={data.revenueTrend.quarters} />
          <span className={`text-xs font-semibold ml-1 ${revPos ? "text-emerald-400" : revNeg ? "text-red-400" : "text-muted-foreground"}`}>
            {data.revenueTrend.direction === "unknown" ? "Insufficient data" : data.revenueTrend.direction.charAt(0).toUpperCase() + data.revenueTrend.direction.slice(1)}
          </span>
        </div>

        <div className="flex items-center gap-2 py-0.5">
          <span className="text-muted-foreground text-xs w-28 shrink-0">Gross Margin</span>
          <Sparkline values={data.marginTrend.quarters} />
          <span className={`text-xs font-semibold ml-1 flex items-center gap-1 ${marPos ? "text-emerald-400" : "text-red-400"}`}>
            {data.marginTrend.direction !== "unknown" && (
              <DirectionArrow positive={marPos} />
            )}
            {data.marginTrend.direction === "unknown" ? "Insufficient data" : data.marginTrend.direction.charAt(0).toUpperCase() + data.marginTrend.direction.slice(1)}
          </span>
        </div>

        <div className="flex items-center gap-2 py-0.5">
          <span className="text-muted-foreground text-xs w-28 shrink-0">Debt Gate</span>
          {data.debtGate.triggered ? (
            <span className="text-red-400 text-xs font-semibold">⚠ Triggered</span>
          ) : (
            <span className="text-emerald-400 text-xs">
              {data.debtGate.debtToEbitda != null
                ? `Debt/EBITDA ${data.debtGate.debtToEbitda.toFixed(1)}×`
                : "Clear"}
            </span>
          )}
        </div>
      </div>
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
}

export function VerdictDetail({ ticker, data, loading }: VerdictDetailProps) {
  if (loading) {
    return (
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24 bg-muted/30" />
            {[...Array(4)].map((_, j) => (
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
        Fundamental data unavailable for {ticker}. Check that FMP_KEY and FINNHUB_KEY are configured.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Explanation */}
      <div className="flex items-start gap-3">
        <VerdictBadge verdict={data.verdict ?? null} size="md" />
        <p className="text-sm text-muted-foreground leading-relaxed">{data.explanation}</p>
      </div>

      {/* Three sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4 pt-2 border-t border-border/50">
        <CheapnessSection data={data.cheapness} />
        <FundamentalsSection data={data.fundamentals} />
        <AnalystsSection analysts={data.analysts} />
      </div>

      {/* Missing data note */}
      {data.missingData.length > 0 && (
        <p className="text-[10px] text-muted-foreground/40 italic pt-1 border-t border-border/30">
          Data unavailable: {data.missingData.join(", ")}
        </p>
      )}
    </div>
  );
}
