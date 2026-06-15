import React from "react";

interface StarButtonProps {
  watched: boolean;
  onToggle: () => void;
}

export function StarButton({ watched, onToggle }: StarButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
      className={`p-1 rounded transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        watched ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground/30 hover:text-muted-foreground/60"
      }`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={watched ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
