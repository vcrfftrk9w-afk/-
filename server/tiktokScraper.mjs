import { chromium } from "playwright";
import { existsSync } from "fs";

// Playwright's default headless mode resolves to a "chrome-headless-shell"
// binary whose exact revision must match the installed `playwright` package
// version. Some pre-provisioned environments only ship a full Chromium
// browser under a fixed path instead. If we find one, use it directly and
// skip Playwright's own resolution; otherwise fall back to its default
// (which is what `npx playwright install chromium` sets up normally).
function resolveExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const candidates = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
  ];
  return candidates.find((p) => existsSync(p));
}

// Best-effort scraper for TikTok's *public* profile pages — reads the same
// data any signed-out browser sees, nothing behind a login. TikTok changes
// its page markup and embedded JSON shape periodically and actively guards
// against automation, so every extraction step here has a fallback and
// every failure surfaces a specific, user-facing reason instead of silently
// returning empty/fake data.

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export class ScrapeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function parseCompactNumber(str) {
  if (!str) return 0;
  const s = String(str).trim().toLowerCase().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*(k|m|b)?$/i);
  if (!m) {
    const n = Number(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  const num = parseFloat(m[1]);
  const suffix = m[2];
  if (!Number.isFinite(num)) return 0;
  if (!suffix) return Math.round(num);
  if (suffix === "k") return Math.round(num * 1_000);
  if (suffix === "m") return Math.round(num * 1_000_000);
  if (suffix === "b") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

async function textOf(page, selector, timeout = 3000) {
  try {
    return await page.locator(selector).first().innerText({ timeout });
  } catch {
    return null;
  }
}

async function withBrowser(fn) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveExecutablePath(),
    args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });
    const page = await context.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function extractUniversalData(page) {
  try {
    const raw = await page.evaluate(() => {
      const el = document.querySelector("#__UNIVERSAL_DATA_FOR_REHYDRATION__");
      return el ? el.textContent : null;
    });
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function detectBlockedOrMissing(page) {
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");
  if (/verify you.re human|are you a robot|complete the (security )?check|captcha/i.test(bodyText)) {
    throw new ScrapeError(
      "BLOCKED",
      "TikTok показал проверку на робота при заходе на страницу — попробуй ещё раз через пару минут",
    );
  }
  if (/couldn.t find this account|user doesn.t exist|page not available/i.test(bodyText)) {
    throw new ScrapeError("NOT_FOUND", "Такого аккаунта не существует или он был удалён");
  }
}

export async function fetchProfileSummary(username) {
  const clean = username.replace(/^@/, "").trim().toLowerCase();
  if (!clean) throw new ScrapeError("INVALID_USERNAME", "Пустой юзернейм");

  return withBrowser(async (page) => {
    let response;
    try {
      response = await page.goto(`https://www.tiktok.com/@${encodeURIComponent(clean)}`, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
    } catch {
      throw new ScrapeError(
        "TIMEOUT",
        "Не удалось загрузить страницу TikTok (таймаут сети). Проверь подключение и попробуй снова",
      );
    }

    if (response && response.status() === 404) {
      throw new ScrapeError("NOT_FOUND", "Такого аккаунта не существует");
    }

    await page.waitForTimeout(1500);
    await detectBlockedOrMissing(page);

    const universal = await extractUniversalData(page);
    const scope = universal?.__DEFAULT_SCOPE__?.["webapp.user-detail"];
    const userInfo = scope?.userInfo || null;

    if (scope && scope.statusCode && scope.statusCode !== 0) {
      throw new ScrapeError("PRIVATE", "Аккаунт приватный, заблокирован или недоступен для просмотра без входа");
    }

    let followers = userInfo?.stats?.followerCount;
    let following = userInfo?.stats?.followingCount;
    let hearts = userInfo?.stats?.heartCount ?? userInfo?.stats?.heart;
    let nickname = userInfo?.user?.nickname;
    let bio = userInfo?.user?.signature;
    let verified = userInfo?.user?.verified;

    if (followers === undefined || followers === null) {
      followers = parseCompactNumber(await textOf(page, '[data-e2e="followers-count"]'));
      following = parseCompactNumber(await textOf(page, '[data-e2e="following-count"]'));
      hearts = parseCompactNumber(await textOf(page, '[data-e2e="likes-count"]'));
    }

    if (followers === undefined || followers === null || Number.isNaN(followers)) {
      throw new ScrapeError(
        "PARSE_ERROR",
        "Не удалось распознать статистику профиля — TikTok мог изменить структуру страницы",
      );
    }

    const videoIds = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/video/"]'));
      const ids = anchors
        .map((a) => {
          const m = a.href.match(/\/video\/(\d+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
      return Array.from(new Set(ids));
    });

    if (videoIds.length === 0) {
      throw new ScrapeError(
        "NO_VIDEOS",
        "Профиль найден, но видео в сетке не подгрузились (приватный аккаунт, нет публикаций, или TikTok отдал урезанную страницу)",
      );
    }

    return {
      username: clean,
      nickname: nickname || clean,
      bio: bio || "",
      verified: !!verified,
      followers: followers || 0,
      following: following || 0,
      hearts: hearts || 0,
      videoIds,
    };
  });
}

export async function fetchVideoDetail(username, videoId) {
  return withBrowser(async (page) => {
    let response;
    try {
      response = await page.goto(
        `https://www.tiktok.com/@${encodeURIComponent(username)}/video/${videoId}`,
        { waitUntil: "domcontentloaded", timeout: 20000 },
      );
    } catch {
      return null;
    }
    if (!response || response.status() >= 400) return null;
    await page.waitForTimeout(1000);

    const universal = await extractUniversalData(page);
    const detail = universal?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;

    if (detail?.stats) {
      const hashtags = (detail.textExtra || [])
        .filter((t) => t.hashtagName)
        .map((t) => `#${t.hashtagName}`);
      const topic = [detail.desc, ...hashtags].filter(Boolean).join(" ").trim();
      return {
        id: videoId,
        postedAt: detail.createTime ? new Date(detail.createTime * 1000).toISOString() : null,
        views: detail.stats.playCount ?? 0,
        likes: detail.stats.diggCount ?? 0,
        comments: detail.stats.commentCount ?? 0,
        shares: detail.stats.shareCount ?? 0,
        topic,
      };
    }

    const likes = parseCompactNumber(await textOf(page, '[data-e2e="like-count"]'));
    const comments = parseCompactNumber(await textOf(page, '[data-e2e="comment-count"]'));
    const shares = parseCompactNumber(await textOf(page, '[data-e2e="share-count"]'));
    const desc = (await textOf(page, '[data-e2e="browse-video-desc"]')) || "";

    if (!likes && !comments && !shares) return null;

    return { id: videoId, postedAt: null, views: 0, likes, comments, shares, topic: desc };
  });
}

export async function importTikTokProfile(username, { videoLimit = 8 } = {}) {
  const summary = await fetchProfileSummary(username);
  const ids = summary.videoIds.slice(0, videoLimit);

  const videos = [];
  const warnings = [];
  for (const id of ids) {
    try {
      const detail = await fetchVideoDetail(summary.username, id);
      if (detail) {
        videos.push(detail);
      } else {
        warnings.push(`Видео ${id}: не удалось получить данные`);
      }
    } catch (e) {
      warnings.push(`Видео ${id}: ${e.message}`);
    }
    // Small pause between video page loads to keep this well within what a
    // normal browsing session looks like, rather than hammering TikTok.
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  if (videos.length === 0) {
    warnings.push("Не удалось получить статистику ни по одному видео — заполни их вручную ниже");
  }

  return {
    username: summary.username,
    nickname: summary.nickname,
    followers: summary.followers,
    videos,
    warnings,
  };
}
