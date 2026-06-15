# Dip Tracker

A market intelligence tool that identifies equities and cryptocurrencies that have fallen in price, helping investors spot potential buying opportunities.

Live at: [https://dip-tracker.replit.app](https://dip-tracker.replit.app)

---

## What it does

- Scans US equities (NASDAQ, S&P 500) and UK ADRs (FTSE 100, FTSE 250) for price drops across four time periods: 1 hour, 24 hours, 1 week, 1 month
- Classifies each drop as company-specific, market/sector-driven, or a relative outperformer (stock held up better than its index)
- Assigns a valuation verdict to each equity based on P/E and P/S ratios relative to sector medians, with a ROIC modifier
- Shows a summary bar, top 10 movers panel, and a filterable/sortable table
- Lets users maintain a personal watchlist
- Data refreshes every 15 minutes via a server-side cache

---

## Tech stack

**Frontend**
- React + Vite, TypeScript
- TanStack Query for data fetching
- Tailwind CSS + shadcn/ui for UI components
- Wouter for routing

**Backend**
- Node.js + Express 5, TypeScript
- PostgreSQL + Drizzle ORM
- In-memory cache with inflight deduplication
- API contract defined in OpenAPI; Zod schemas generated from spec

**Market data**
- Polygon.io grouped daily endpoint (all US stocks in one API call — avoids per-ticker rate limits on the free tier)
- Financial Modeling Prep for fundamentals (P/E, P/S, ROIC)
- Finnhub for analyst ratings and price targets

**Monorepo**
- pnpm workspaces
- Shared libraries: `api-spec` (OpenAPI), `api-client-react` (generated hooks), `api-zod` (generated Zod schemas)
- Codegen via Orval

---

## Running locally
**Prerequisites:** Node.js 24, pnpm, PostgreSQL

bash
# Install dependencies
pnpm install
# Set environment variables
DATABASE_URL=...
POLYGON_API_KEY=...
FMP_KEY=...
FINNHUB_KEY=...
# Run database migrations
pnpm --filter @workspace/api-server run db:migrate
# Start API server (port 5000)
pnpm --filter @workspace/api-server run dev
# Start frontend
pnpm --filter @workspace/dip-tracker run dev

Project structure
artifacts/
  api-server/       Express API server
  dip-tracker/      React frontend
lib/
  api-spec/         OpenAPI contract (source of truth)
  api-client-react/ Generated React Query hooks
  api-zod/          Generated Zod validation schemas

Notes
- FTSE stocks are tracked via their US ADR tickers (e.g. SHEL, AZN, HSBC) since Polygon covers US markets only.
- Valuation verdicts are based on quantitative metrics only and do not account for qualitative factors — this is not financial advice. 
- The drop classifier computes excess return vs. a benchmark index to separate stock-specific moves from broader market moves.
