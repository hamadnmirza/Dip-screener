import React from "react";
import { useGetDropCause, getGetDropCauseQueryKey } from "@workspace/api-client-react";
import type { DropClassification, GetDropCausePeriod } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DropCauseBadge } from "./DropCauseBadge";

// ── Sub-components ────────────────────────────────────────────────────────────

const MOVE_TYPE_LABELS: Record<string, string> = {
  company_specific:      "Company-specific",
  market_driven:         "Market / sector driven",
  relative_outperformer: "Outperforming sector",
  insufficient_data:     "Insufficient data",
};

const MOVE_TYPE_STYLES: Record<string, string> = {
  company_specific:      "text-amber-400 bg-amber-500/10 border-amber-500/20",
  market_driven:         "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  relative_outperformer: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  insufficient_data:     "text-muted-foreground/50 bg-muted/20 border-border/30",
};

function fmt(v: number | null | undefined): string {
  if (v == null) return "N/A";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function WhyItDroppedContent({ data }: { data: DropClassification }) {
  const moveStyle =
    MOVE_TYPE_STYLES[data.moveType] ?? MOVE_TYPE_STYLES.insufficient_data;
  const moveLabel = MOVE_TYPE_LABELS[data.moveType] ?? data.moveType;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Why It Dropped
        </span>
        <DropCauseBadge classification={data} size="xs" />
      </div>

      <div className="space-y-0.5">
        {/* Move type */}
        <div className="flex items-center justify-between gap-2 py-0.5">
          <span className="text-muted-foreground text-xs shrink-0">Move type</span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${moveStyle}`}
          >
            {moveLabel}
          </span>
        </div>

        {/* Excess move vs benchmark */}
        {data.excessMove != null && (
          <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-muted-foreground text-xs shrink-0">
              vs {data.sectorBenchmark}
            </span>
            <span
              className={`text-xs font-mono font-semibold ${
                data.excessMove <= -2
                  ? "text-red-400"
                  : data.excessMove >= 1
                  ? "text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              {fmt(data.excessMove)}
            </span>
          </div>
        )}

        {/* Sector return */}
        {data.sectorReturn != null && (
          <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-muted-foreground text-xs shrink-0">
              {data.sectorBenchmark} return
            </span>
            <span className="text-xs font-mono text-muted-foreground/70">
              {fmt(data.sectorReturn)}
            </span>
          </div>
        )}

        {/* Confidence */}
        <div className="flex items-center justify-between gap-2 py-0.5">
          <span className="text-muted-foreground text-xs shrink-0">Confidence</span>
          <span
            className={`text-xs font-semibold ${
              data.confidence === "high"
                ? "text-emerald-400"
                : data.confidence === "medium"
                ? "text-amber-400"
                : "text-muted-foreground/50"
            }`}
          >
            {data.confidence.charAt(0).toUpperCase() + data.confidence.slice(1)}
          </span>
        </div>
      </div>

      {/* Rationale callout — matches ROIC-shift callout style */}
      <p className="mt-2 text-[10px] rounded px-2 py-1.5 leading-relaxed border text-muted-foreground/70 bg-muted/20 border-border/30">
        {data.rationale}
      </p>

      {/* Lineage */}
      <p className="mt-1 text-[9px] text-muted-foreground/30 leading-relaxed">
        Benchmark: {data.sectorBenchmark} ·{" "}
        {new Date(data.asOf).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · {data.disclaimer}
      </p>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface WhyItDroppedProps {
  ticker: string;
  period: string;
}

export function WhyItDropped({ ticker, period }: WhyItDroppedProps) {
  const safePeriod = (["1h", "24h", "1w", "1m"].includes(period)
    ? period
    : "24h") as GetDropCausePeriod;

  const { data, isLoading, isError } = useGetDropCause(
    { ticker, period: safePeriod },
    {
      query: {
        queryKey: getGetDropCauseQueryKey({ ticker, period: safePeriod }),
      },
    }
  );

  if (isLoading) {
    return (
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Why It Dropped
        </span>
        <div className="mt-2 space-y-1.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-3.5 w-full bg-muted/20" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Why It Dropped
        </span>
        <p className="mt-1 text-xs text-muted-foreground/40 italic">
          Classification unavailable.
        </p>
      </div>
    );
  }

  return <WhyItDroppedContent data={data} />;
}
