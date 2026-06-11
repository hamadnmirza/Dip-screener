import React from "react";

export type VerdictString =
  | "Potential Bargain"
  | "Falling Knife"
  | "Repricing"
  | "Avoid"
  | "Cheap — Unverified"
  | "Not Cheap — Unverified"
  | null
  | undefined;

interface VerdictBadgeProps {
  verdict: VerdictString | string | null | undefined;
  size?: "sm" | "md";
}

const VERDICT_STYLES: Record<string, string> = {
  "Potential Bargain":    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  "Falling Knife":        "bg-red-500/15 text-red-400 border border-red-500/30",
  "Repricing":            "bg-slate-500/15 text-slate-400 border border-slate-500/30",
  "Avoid":                "bg-red-900/20 text-red-600 border border-red-900/40",
  "Cheap — Unverified":   "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  "Not Cheap — Unverified": "bg-amber-500/10 text-amber-500/70 border border-amber-500/20",
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
