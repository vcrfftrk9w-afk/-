import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { importTikTokProfile, ScrapeError } from "./tiktokScraper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Minimal per-IP throttle so a misclick/retry storm doesn't hammer TikTok
// from this server's IP and get it flagged faster than it already will be.
const lastRequestAt = new Map();
const MIN_INTERVAL_MS = 15_000;

function throttle(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const last = lastRequestAt.get(key) || 0;
  if (now - last < MIN_INTERVAL_MS) {
    return res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Подожди немного перед следующим импортом (не чаще раза в 15 секунд)",
      },
    });
  }
  lastRequestAt.set(key, now);
  next();
}

const ERROR_STATUS = {
  INVALID_USERNAME: 400,
  NOT_FOUND: 404,
  PRIVATE: 403,
  BLOCKED: 503,
  TIMEOUT: 504,
  PARSE_ERROR: 502,
  NO_VIDEOS: 404,
};

app.get("/api/tiktok-import/:username", throttle, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 15);
  try {
    const result = await importTikTokProfile(req.params.username, { videoLimit: limit });
    res.json(result);
  } catch (err) {
    if (err instanceof ScrapeError) {
      res.status(ERROR_STATUS[err.code] || 500).json({ error: { code: err.code, message: err.message } });
      return;
    }
    console.error("[tiktok-import] unexpected error:", err);
    res.status(500).json({
      error: {
        code: "UNKNOWN",
        message: "Что-то пошло не так при импорте. Попробуй ещё раз или заполни данные вручную",
      },
    });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// In production (`npm run start`), also serve the built frontend from this
// same process so the whole app runs as one server on one port.
const distDir = path.resolve(__dirname, "..", "dist");
app.use(express.static(distDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`[server] TikTok import API listening on http://localhost:${PORT}`);
});
