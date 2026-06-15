import React from "react";

export type VerdictString =
  | "Undervalued"
  | "At value"
  | "Overvalued (adjusted)"
  | "Overvalued"
  | null
  | undefined;

interface VerdictBadgeProps {
  verdict: VerdictString | string | null | undefined;
  size?: "sm" | "md";
}

const VERDICT_STYLES: Record<string, string> = {
  "Undervalued":           "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  "At value":              "bg-sky-500/15 text-sky-400 border border-sky-500/30",
  "Overvalued (adjusted)": "bg-amber-500/10 text-amber-300/80 border border-amber-500/20",
  "Overvalued":            "bg-amber-500/15 text-amber-400 border border-amber-500/30",
};

export function VerdictBadge({ verdict, size = "sm" }: VerdictBadgeProps) {
  if (!verdict || verdict === "null") {
    return <span className="text-muted-foreground/40 select-none">—</span>;
  }

  const style = VERDICT_STYLES[verdict] ?? "bg-muted/20 text-muted-foreground border border-border";
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-block rounded font-semibold tracking-tight whitespace-nowrap ${padding} ${style}`}>
      {verdict}
    </span>
  );
}
