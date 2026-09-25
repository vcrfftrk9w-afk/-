// ─────────────────────────────────────────────────────────────────────────────
// Локальный аналитический движок: считает метрики, скоринг и инсайты
// без внешних API. Результат также передаётся AI как «факты».
// ─────────────────────────────────────────────────────────────────────────────
import type { Account, HeatCell, Insight, LocalReport, SubScore, TikTokVideo, UserSettings } from "./types";
import { DAYS_RU, DEFAULT_BEST_SLOTS, getNiche } from "./knowledge";

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const er = (v: TikTokVideo) => (v.views > 0 ? ((v.likes + v.comments + v.shares) / v.views) * 100 : 0);

export function extractHashtags(text: string): string[] {
  return Array.from(new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.toLowerCase())));
}

// Логарифмическая шкала: 0 при x<=lo, 100 при x>=hi
const logScale = (x: number, lo: number, hi: number) => {
  if (x <= lo) return 0;
  if (x >= hi) return 100;
  return ((Math.log(x) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * 100;
};

export function levelFor(score: number): string {
  if (score >= 85) return "Вирусная машина";
  if (score >= 70) return "Восходящая звезда";
  if (score >= 55) return "Растущий автор";
  if (score >= 40) return "На разгоне";
  if (score >= 25) return "Старт";
  return "Новичок";
}

export function buildLocalReport(account: Account, settings: UserSettings): LocalReport {
  const { profile } = account;
  const videos = [...account.videos].sort((a, b) => b.createTime - a.createTime);
  const niche = getNiche(settings.niche);
  const now = Date.now() / 1000;

  const views = videos.map((v) => v.views);
  const avgViews = avg(views);
  const medianViews = median(views);
  const totalViews = views.reduce((s, x) => s + x, 0) || 1;
  const sumBy = (k: "likes" | "comments" | "shares") => videos.reduce((s, v) => s + v[k], 0);
  const likeRate = (sumBy("likes") / totalViews) * 100;
  const commentRate = (sumBy("comments") / totalViews) * 100;
  const shareRate = (sumBy("shares") / totalViews) * 100;
  const engagementRate = likeRate + commentRate + shareRate;
  const viewsPerFollower = profile.followers > 0 ? medianViews / profile.followers : medianViews > 0 ? 5 : 0;

  // Регулярность: публикации за последние 28 дней
  const last28 = videos.filter((v) => now - v.createTime < 28 * 86400);
  const postsPerWeek = videos.length ? last28.length / 4 : 0;
  const daysSinceLastPost = videos.length ? Math.floor((now - videos[0].createTime) / 86400) : null;

  // Хэштеги
  const tagMap = new Map<string, { views: number; uses: number }>();
  for (const v of videos) {
    for (const t of v.hashtags) {
      const e = tagMap.get(t) ?? { views: 0, uses: 0 };
      e.views += v.views;
      e.uses += 1;
      tagMap.set(t, e);
    }
  }
  const topHashtags = [...tagMap.entries()]
    .map(([tag, e]) => ({ tag, avgViews: Math.round(e.views / e.uses), uses: e.uses }))
    .filter((t) => t.uses >= 1)
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 10);
  const avgTagsPerVideo = avg(videos.map((v) => v.hashtags.length));

  // Длительность
  const buckets = [
    { label: "до 15 с", min: 0, max: 15 },
    { label: "15–30 с", min: 15, max: 30 },
    { label: "30–60 с", min: 30, max: 60 },
    { label: "1–3 мин", min: 60, max: 180 },
    { label: "3+ мин", min: 180, max: 1e9 },
  ];
  const durationBuckets = buckets.map((b) => {
    const vs = videos.filter((v) => v.duration >= b.min && v.duration < b.max);
    return { label: b.label, avgViews: Math.round(avg(vs.map((v) => v.views))), count: vs.length };
  });

  // Тепловая карта день×час (по медиане просмотров относительно общей медианы)
  const cellMap = new Map<string, number[]>();
  for (const v of videos) {
    const d = new Date(v.createTime * 1000);
    const day = (d.getDay() + 6) % 7;
    const hour = d.getHours();
    const key = `${day}-${hour}`;
    const arr = cellMap.get(key) ?? [];
    arr.push(v.views);
    cellMap.set(key, arr);
  }
  const heatRaw: HeatCell[] = [];
  let maxVal = 0;
  for (const [key, arr] of cellMap) {
    const [day, hour] = key.split("-").map(Number);
    const val = median(arr) / (medianViews || 1);
    maxVal = Math.max(maxVal, val);
    heatRaw.push({ day, hour, value: val, count: arr.length });
  }
  const heatmap = heatRaw.map((c) => ({ ...c, value: maxVal ? c.value / maxVal : 0 }));
  const bestSlots =
    heatmap.length >= 4
      ? [...heatmap]
          .filter((c) => c.count >= 1)
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
          .map((c) => ({ day: c.day, hour: c.hour, label: `${DAYS_RU[c.day]} ${String(c.hour).padStart(2, "0")}:00` }))
      : DEFAULT_BEST_SLOTS;

  const sortedByViews = [...videos].sort((a, b) => b.views - a.views);
  const bestVideo = sortedByViews[0];
  const worstVideo = sortedByViews[sortedByViews.length - 1];

  // ── Подоценки ─────────────────────────────────────────────────────────────
  const reachScore = clamp(logScale(Math.max(viewsPerFollower, 0.001), 0.05, 3));
  const erScore = clamp((engagementRate / (niche.benchmarkER * 1.4)) * 100);
  const conversationScore = clamp(((commentRate + shareRate * 1.5) / 1.2) * 100);
  const consistencyScore = clamp(
    (Math.min(postsPerWeek, settings.postsPerWeek || 7) / Math.max(settings.postsPerWeek || 7, 3)) * 80 +
      (daysSinceLastPost === null ? 0 : daysSinceLastPost <= 2 ? 20 : daysSinceLastPost <= 7 ? 10 : 0),
  );
  const tagsScore = clamp(
    (avgTagsPerVideo >= 3 && avgTagsPerVideo <= 6 ? 60 : avgTagsPerVideo > 0 ? 35 : 10) +
      (videos.some((v) => v.title.length > 20) ? 20 : 0) +
      (topHashtags.length >= 5 ? 20 : topHashtags.length * 4),
  );
  const bio = profile.bio ?? "";
  const profileScore = clamp(
    (profile.avatarUrl ? 25 : 0) +
      (bio.length >= 20 ? 30 : bio.length > 0 ? 15 : 0) +
      (/[\p{Emoji_Presentation}]/u.test(bio) ? 10 : 0) +
      (/(👇|ссылк|link|tg|telegram|inst|youtube|@)/i.test(bio) ? 15 : 0) +
      (profile.displayName && profile.displayName !== profile.username ? 20 : 10),
  );
  const growthScore = clamp(logScale(Math.max(profile.followers, 1), 10, 1_000_000));

  const subScores: SubScore[] = [
    { key: "reach", label: "Охват", score: Math.round(reachScore), hint: `Медиана просмотров = ${(viewsPerFollower * 100).toFixed(0)}% от подписчиков` },
    { key: "engagement", label: "Вовлечённость", score: Math.round(erScore), hint: `ER ${engagementRate.toFixed(1)}% (норма ниши ≈ ${niche.benchmarkER}%)` },
    { key: "conversation", label: "Обсуждаемость", score: Math.round(conversationScore), hint: `Комменты ${commentRate.toFixed(2)}%, репосты ${shareRate.toFixed(2)}%` },
    { key: "consistency", label: "Регулярность", score: Math.round(consistencyScore), hint: `${postsPerWeek.toFixed(1)} видео/нед · цель ${settings.postsPerWeek}` },
    { key: "seo", label: "Хэштеги и SEO", score: Math.round(tagsScore), hint: `${avgTagsPerVideo.toFixed(1)} хэштега на видео` },
    { key: "profile", label: "Упаковка профиля", score: Math.round(profileScore), hint: bio ? "Био заполнено" : "Био пустое — теряешь подписки" },
  ];

  const weights = { reach: 0.28, engagement: 0.2, conversation: 0.14, consistency: 0.18, seo: 0.08, profile: 0.12 };
  let viralScore = subScores.reduce((s, x) => s + x.score * weights[x.key as keyof typeof weights], 0);
  viralScore = viralScore * 0.9 + growthScore * 0.1;
  if (!videos.length) viralScore = Math.min(viralScore, 20);
  viralScore = Math.round(clamp(viralScore));

  // ── Инсайты ───────────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  if (!videos.length) {
    insights.push({ type: "tip", title: "Начни с 3 роликов за 3 дня", text: "Алгоритму нужны данные. Выложи 3 видео в своей нише — и я смогу дать точную аналитику.", impact: "high" });
  }
  if (daysSinceLastPost !== null && daysSinceLastPost > 4) {
    insights.push({ type: "warn", title: `Ты не публиковал(а) ${daysSinceLastPost} дн.`, text: "Перерывы охлаждают аккаунт: алгоритм реже показывает новые ролики. Вернись с серией из 3 видео за 3 дня.", impact: "high" });
  }
  if (postsPerWeek < Math.min(settings.postsPerWeek, 5) && videos.length) {
    insights.push({ type: "warn", title: "Мало публикаций", text: `Сейчас ${postsPerWeek.toFixed(1)} видео в неделю. Для быстрого роста нужно минимум ${Math.max(5, settings.postsPerWeek)}: больше попыток — больше шансов на вирусный ролик.`, impact: "high" });
  }
  if (videos.length && viewsPerFollower < 0.3 && profile.followers > 500) {
    insights.push({ type: "warn", title: "Подписчики не видят ролики", text: "Медиана просмотров ниже 30% от подписчиков — хуки слабые или контент ушёл от ниши, на которую подписывались. Усиль первые 2 секунды.", impact: "high" });
  }
  if (viewsPerFollower > 1.5) {
    insights.push({ type: "win", title: "Сильный охват за пределами подписчиков", text: "Ролики стабильно уходят в рекомендации. Самое время увеличить частоту постинга — окно роста открыто.", impact: "high" });
  }
  if (engagementRate >= niche.benchmarkER) {
    insights.push({ type: "win", title: "Вовлечённость выше нормы ниши", text: `ER ${engagementRate.toFixed(1)}% при норме ≈${niche.benchmarkER}%. Аудитория тебя любит — делай больше контента в рубриках, которые уже выстрелили.`, impact: "medium" });
  } else if (videos.length) {
    insights.push({ type: "tip", title: "Подними вовлечённость", text: "Добавь в каждый ролик вопрос-провокацию, спорный пункт или «напиши номер». Закрепляй свой комментарий с вопросом.", impact: "medium" });
  }
  if (commentRate < 0.15 && videos.length) {
    insights.push({ type: "tip", title: "Мало комментариев", text: "Комментарии — топ-сигнал для алгоритма. Используй хуки-споры, тир-листы, «угадай» и отвечай видео на комментарии.", impact: "medium" });
  }
  const bestBucket = [...durationBuckets].filter((b) => b.count >= 2).sort((a, b) => b.avgViews - a.avgViews)[0];
  if (bestBucket) {
    insights.push({ type: "win", title: `Лучшая длина: ${bestBucket.label}`, text: `Ролики такой длины в среднем набирают ${formatNum(bestBucket.avgViews)} просмотров. Делай 60% роликов в этом формате.`, impact: "medium" });
  }
  if (avgTagsPerVideo > 7) {
    insights.push({ type: "tip", title: "Слишком много хэштегов", text: "Оставь 3–5 точных: 1 широкий, 2 нишевых, 1–2 под конкретное видео. Спам хэштегами размывает понимание алгоритмом, кому показать ролик.", impact: "low" });
  } else if (avgTagsPerVideo < 2 && videos.length) {
    insights.push({ type: "tip", title: "Добавь хэштеги и ключевые слова", text: "TikTok — поисковик. Пиши ключевые слова в подписи и на экране + 3–5 хэштегов.", impact: "low" });
  }
  if (!bio || bio.length < 20) {
    insights.push({ type: "warn", title: "Упакуй профиль", text: "Био должно отвечать на вопрос «зачем подписываться»: кто ты + какая польза + частота. Пример: «Танцы за 15 сек каждый день 💃 Учу трендам первым».", impact: "medium" });
  }
  if (bestVideo && medianViews > 0 && bestVideo.views > medianViews * 5) {
    insights.push({ type: "win", title: "У тебя есть вирусный шаблон", text: `Ролик «${bestVideo.title.slice(0, 60)}» набрал в ${Math.round(bestVideo.views / medianViews)}× больше медианы. Сделай 3 вариации этой идеи на этой неделе.`, impact: "high" });
  }

  const timeline = [...videos]
    .reverse()
    .slice(-30)
    .map((v) => ({
      date: new Date(v.createTime * 1000).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      views: v.views,
      er: Number(er(v).toFixed(2)),
      title: v.title,
    }));

  return {
    viralScore,
    level: levelFor(viralScore),
    subScores,
    avgViews,
    medianViews,
    engagementRate,
    likeRate,
    commentRate,
    shareRate,
    viewsPerFollower,
    postsPerWeek,
    daysSinceLastPost,
    bestVideo,
    worstVideo,
    topHashtags,
    durationBuckets,
    heatmap,
    bestSlots,
    insights: insights.sort((a, b) => rank(b.impact) - rank(a.impact)),
    timeline,
  };
}

const rank = (i?: string) => (i === "high" ? 3 : i === "medium" ? 2 : 1);

export function formatNum(n: number): string {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + " млрд";
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return Math.round(n).toString();
}

// ── Прогноз роста ───────────────────────────────────────────────────────────
// Модель: ежедневный прирост = базовый (из текущих метрик) × множитель плана.
export function forecastGrowth(account: Account, report: LocalReport, settings: UserSettings, days = 90) {
  const f0 = Math.max(account.profile.followers, 0);
  // Конверсия просмотров в подписки ~0.3–1.5% в зависимости от вовлечённости
  const conv = 0.003 + Math.min(report.engagementRate, 15) * 0.0007;
  const postsPerDayNow = Math.max(report.postsPerWeek, 0.3) / 7;
  const postsPerDayPlan = Math.max(settings.postsPerWeek, 3) / 7;
  const baseViews = Math.max(report.medianViews, 150);
  const out: { day: number; current: number; withPlan: number }[] = [];
  let cur = f0;
  let plan = f0;
  for (let d = 0; d <= days; d++) {
    out.push({ day: d, current: Math.round(cur), withPlan: Math.round(plan) });
    // Текущая траектория
    cur += baseViews * postsPerDayNow * conv;
    // С планом: частота + улучшение хуков (просмотры растут до ×3 за 60 дней) + шанс вирусности
    const skill = 1 + Math.min(d / 60, 1) * 2;
    const viralBoost = d > 0 && d % 14 === 0 ? baseViews * skill * 8 * conv : 0;
    plan += baseViews * skill * postsPerDayPlan * conv * 1.15 + viralBoost + plan * 0.0025;
  }
  return out;
}
