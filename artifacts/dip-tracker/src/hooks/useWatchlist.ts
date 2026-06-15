import { useState, useCallback } from "react";

const STORAGE_KEY = "dip-tracker-watchlist";

export interface WatchlistEntry {
  ticker: string;
  addedAt: string;
}

function load(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WatchlistEntry[];
  } catch {
    return [];
  }
}

function save(entries: WatchlistEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>(load);

  const toggle = useCallback((ticker: string) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e.ticker === ticker);
      const next = exists
        ? prev.filter((e) => e.ticker !== ticker)
        : [...prev, { ticker, addedAt: new Date().toISOString() }];
      save(next);
      return next;
    });
  }, []);

  const isWatched = useCallback(
    (ticker: string) => entries.some((e) => e.ticker === ticker),
    [entries]
  );

  const tickers = entries.map((e) => e.ticker);

  return { entries, tickers, toggle, isWatched };
}
