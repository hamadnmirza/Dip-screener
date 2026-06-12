import React from "react";
import type {
  TickerVerdict,
  MultipleResult,
  CheapnessResult,
  FundamentalsResult,
  EstimateRevisions,
  RoicResult,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBadge } from "./VerdictBadge";

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
  strong_positive: { bar: "bg-emerald-500",     text: "text-emerald-400",       label: "Elite" },
  positive:        { bar: "bg-emerald-500/70",   text: "text-emerald-400/80",    label: "Value-Creating" },
  neutral:         { bar: "bg-slate-500",        text: "text-muted-foreground",  label: "Neutral" },
  negative:        { bar: "bg-amber-500",        text: "text-amber-400",         label: "Below WACC" },
  strong_negative: { bar: "bg-red-500",          text: "text-red-400",           label: "Destroys Capital" },
  skipped:         { bar: "bg-slate-700",        text: "text-muted-foreground/50", label: "N/A" },
  missing:         { bar: "bg-slate-700",        text: "text-muted-foreground/50", label: "Unavailable" },
};

function RoicSection({ data, verdictShifted, verdictBase, verdict }: {
  data: RoicResult;
  verdictShifted: boolean;
  verdictBase?: string | null;
  verdict?: string | null;
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

        {/* Shift indicator */}
        {verdictShifted && verdictBase && verdict && (
          <p className="text-[10px] text-sky-400/80 bg-sky-500/10 border border-sky-500/20 rounded px-2 py-1 leading-relaxed">
            ROIC shifted verdict: "{verdictBase}" → "{verdict}"
          </p>
        )}
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

  const roicShifted = !!(data.roic && data.verdictBase && data.verdict && data.verdictBase !== data.verdict);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <VerdictBadge verdict={data.verdict ?? null} size="md" />
        <p className="text-sm text-muted-foreground leading-relaxed">{data.explanation}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-4 pt-2 border-t border-border/50">
        <CheapnessSection data={data.cheapness} />
        <FundamentalsSection data={data.fundamentals} />
        {data.roic && (
          <RoicSection
            data={data.roic}
            verdictShifted={roicShifted}
            verdictBase={data.verdictBase}
            verdict={data.verdict}
          />
        )}
        <AnalystsSection analysts={data.analysts} />
      </div>

      {data.missingData.length > 0 && (
        <p className="text-[10px] text-muted-foreground/40 italic pt-1 border-t border-border/30">
          Data unavailable: {data.missingData.join(", ")}
        </p>
      )}
    </div>
  );
}
