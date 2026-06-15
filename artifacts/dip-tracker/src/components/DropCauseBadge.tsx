import React from "react";
import type { DropClassification } from "@workspace/api-client-react";

const SIGNAL_STYLES: Record<string, string> = {
  green:   "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  amber:   "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  red:     "bg-red-500/15 text-red-400 border border-red-500/30",
  neutral: "bg-muted/20 text-muted-foreground border border-border",
};

export const CAUSE_LABELS: Record<string, string> = {
  sector_macro:          "Sector Move",
  technical_no_news:     "No News",
  operational_stumble:   "Op. Stumble",
  thesis_impairment:     "Thesis Risk",
  secular_decline:       "Secular Decline",
  solvency_stress:       "Fin. Stress",
  governance_accounting: "Governance",
  corporate_action:      "Corp. Action",
  unknown:               "Unknown",
};

const CONFIDENCE_DOT_CLASSES: Record<string, string> = {
  high:   "w-1.5 h-1.5 rounded-full bg-current flex-shrink-0",
  medium: "w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0",
  low:    "w-1.5 h-1.5 rounded-full border border-current opacity-40 flex-shrink-0",
};

interface DropCauseBadgeProps {
  classification: DropClassification;
  size?: "xs" | "sm";
}

export function DropCauseBadge({ classification, size = "sm" }: DropCauseBadgeProps) {
  const signal = classification.cause.signal ?? "neutral";
  const dominant = classification.cause.dominant;
  const label = CAUSE_LABELS[dominant] ?? dominant;
  const signalStyle = SIGNAL_STYLES[signal] ?? SIGNAL_STYLES.neutral;
  const dotClass = CONFIDENCE_DOT_CLASSES[classification.confidence] ?? CONFIDENCE_DOT_CLASSES.low;
  const px = size === "xs" ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold tracking-tight whitespace-nowrap ${px} ${signalStyle}`}
      title={`${classification.rationale} (${classification.confidence} confidence)`}
    >
      <span className={dotClass} />
      {label}
    </span>
  );
}
