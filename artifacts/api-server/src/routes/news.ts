import { Router, type IRouter } from "express";
import { fetchTickerNews } from "../lib/finnhub";

const router: IRouter = Router();

router.get("/news/:ticker", async (req, res) => {
  const ticker = req.params.ticker?.trim().toUpperCase();
  if (!ticker || !/^[A-Z0-9.^-]{1,12}$/.test(ticker)) {
    res.status(400).json({ error: "Invalid ticker symbol" });
    return;
  }

  const articles = await fetchTickerNews(ticker);
  res.json({ articles });
});

export default router;
