import { seededRandom, randInt, randFloat, shuffle } from "./rng";
import { Niche, getNiche } from "./niches";

export type MetricKey =
  | "engagement"
  | "consistency"
  | "hook"
  | "trendUsage"
  | "retention"
  | "hashtags";

export interface Metric {
  key: MetricKey;
  label: string;
  value: number; // 0-100
  icon: string;
}

export interface ContentPillar {
  name: string;
  share: number; // %
  idealShare: number; // %
}

export interface HeatCell {
  day: string;
  slot: string;
  value: number; // 0-100 engagement intensity
}

export interface GrowthPoint {
  label: string;
  followers: number;
}

export interface ProfileStats {
  username: string;
  niche: Niche;
  followers: number;
  followersLastMonth: number;
  avgViews: number;
  avgLikes: number;
  engagementRate: number;
  postsPerWeek: number;
  metrics: Metric[];
  growthScore: number;
  tier: "Новичок" | "Растущий" | "Уверенный" | "Про";
  weakPoints: Metric[];
  strongPoints: Metric[];
  contentPillars: ContentPillar[];
  heatmap: HeatCell[];
  bestSlot: { day: string; slot: string };
  growthHistory: GrowthPoint[];
  projectedDaysTo: { milestone: number; days: number }[];
}

const METRIC_META: Record<MetricKey, { label: string; icon: string }> = {
  engagement: { label: "Вовлечённость", icon: "Heart" },
  consistency: { label: "Регулярность публикаций", icon: "CalendarClock" },
  hook: { label: "Сила хука (первые 3 сек)", icon: "Zap" },
  trendUsage: { label: "Использование трендов", icon: "TrendingUp" },
  retention: { label: "Удержание досмотра", icon: "Timer" },
  hashtags: { label: "Стратегия хэштегов", icon: "Hash" },
};

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const SLOTS = ["06–10", "10–14", "14–18", "18–22", "22–02"];

export function analyzeProfile(username: string, niche: Niche): ProfileStats {
  const clean = username.trim().replace(/^@/, "").toLowerCase() || "creator";
  const rng = seededRandom(clean, niche);

  const followers = Math.round(randInt(rng, 320, 48000) / 10) * 10;
  const monthGrowthPct = randFloat(rng, -4, 35, 1);
  const followersLastMonth = Math.max(
    0,
    Math.round(followers / (1 + monthGrowthPct / 100)),
  );
  const avgViews = Math.round(
    followers * randFloat(rng, 0.6, 4.2, 2) + randInt(rng, 50, 900),
  );
  const engagementRate = randFloat(rng, 2.5, 13.5, 1);
  const avgLikes = Math.round(avgViews * (engagementRate / 100) * randFloat(rng, 0.7, 0.95, 2));
  const postsPerWeek = randInt(rng, 1, 10);

  const metricValues: Record<MetricKey, number> = {
    engagement: clamp(Math.round(engagementRate * 6 + randInt(rng, -8, 8))),
    consistency: clamp(Math.round(postsPerWeek * 9 + randInt(rng, -10, 10))),
    hook: randInt(rng, 25, 95),
    trendUsage: randInt(rng, 15, 95),
    retention: randInt(rng, 20, 92),
    hashtags: randInt(rng, 20, 90),
  };

  const metrics: Metric[] = (Object.keys(metricValues) as MetricKey[]).map(
    (key) => ({
      key,
      label: METRIC_META[key].label,
      icon: METRIC_META[key].icon,
      value: metricValues[key],
    }),
  );

  const weights: Record<MetricKey, number> = {
    engagement: 0.28,
    consistency: 0.16,
    hook: 0.22,
    trendUsage: 0.14,
    retention: 0.14,
    hashtags: 0.06,
  };

  const growthScore = Math.round(
    metrics.reduce((sum, m) => sum + m.value * weights[m.key], 0),
  );

  const tier: ProfileStats["tier"] =
    growthScore >= 80
      ? "Про"
      : growthScore >= 60
        ? "Уверенный"
        : growthScore >= 40
          ? "Растущий"
          : "Новичок";

  const sorted = [...metrics].sort((a, b) => a.value - b.value);
  const weakPoints = sorted.slice(0, 3);
  const strongPoints = [...metrics].sort((a, b) => b.value - a.value).slice(0, 2);

  const nicheInfo = getNiche(niche);
  const rawShares = nicheInfo.pillars.map(() => randFloat(rng, 8, 40, 0));
  const total = rawShares.reduce((a, b) => a + b, 0);
  const contentPillars: ContentPillar[] = nicheInfo.pillars.map((name, i) => ({
    name,
    share: Math.round((rawShares[i] / total) * 100),
    idealShare: Math.round(100 / nicheInfo.pillars.length),
  }));
  // normalize rounding drift
  const drift = 100 - contentPillars.reduce((a, p) => a + p.share, 0);
  contentPillars[0].share += drift;

  const heatmap: HeatCell[] = [];
  let bestSlot = { day: DAYS[0], slot: SLOTS[0] };
  let bestVal = -1;
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      const value = randInt(rng, 5, 100);
      heatmap.push({ day, slot, value });
      if (value > bestVal) {
        bestVal = value;
        bestSlot = { day, slot };
      }
    }
  }

  const growthHistory: GrowthPoint[] = [];
  const weeks = 10;
  let cur = followersLastMonth * randFloat(rng, 0.85, 0.98, 3);
  const trendStrength = 1 + (growthScore - 50) / 900;
  for (let i = 0; i < weeks; i++) {
    cur = cur * (trendStrength + randFloat(rng, -0.02, 0.03, 3));
    growthHistory.push({ label: `Нед ${i + 1}`, followers: Math.round(cur) });
  }
  growthHistory[growthHistory.length - 1].followers = followers;

  const weeklyGrowthRate =
    Math.pow(followers / Math.max(followersLastMonth, 1), 1 / 4) - 1;
  const safeRate = Math.max(weeklyGrowthRate, 0.004);
  const milestones = [1000, 5000, 10000, 50000, 100000, 1000000].filter(
    (m) => m > followers,
  );
  const projectedDaysTo = milestones.slice(0, 3).map((milestone) => {
    const weeksNeeded = Math.log(milestone / followers) / Math.log(1 + safeRate);
    return { milestone, days: Math.max(3, Math.round(weeksNeeded * 7)) };
  });

  return {
    username: clean,
    niche,
    followers,
    followersLastMonth,
    avgViews,
    avgLikes,
    engagementRate,
    postsPerWeek,
    metrics,
    growthScore,
    tier,
    weakPoints,
    strongPoints,
    contentPillars,
    heatmap,
    bestSlot,
    growthHistory,
    projectedDaysTo,
  };
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

export const COACH_ADVICE: Record<MetricKey, { title: string; tips: string[] }> = {
  engagement: {
    title: "Подними вовлечённость",
    tips: [
      "Задавай прямой вопрос в последние 2 секунды видео — комментарии решают алгоритм",
      "Используй CTA \"напиши в комменты, если...\" вместо просто \"подпишись\"",
      "Отвечай видео-ответами на лучшие комментарии — это отдельный формат с высоким охватом",
      "Публикуй споры/два мнения — контент, который провоцирует дискуссию, живёт дольше",
    ],
  },
  consistency: {
    title: "Стабилизируй график публикаций",
    tips: [
      "Публикуй минимум 4–5 раз в неделю первые 60 дней — алгоритм любит предсказуемость",
      "Сними 5–7 видео за одну сессию батчами, чтобы не терять темп в загруженные дни",
      "Заведи контент-календарь на неделю вперёд с готовыми темами",
      "Лучше 1 видео в день среднего качества, чем 1 видео в неделю идеального",
    ],
  },
  hook: {
    title: "Усиль хук в первые 3 секунды",
    tips: [
      "Начинай с результата или самого яркого момента, а не с вступления \"привет, сегодня я...\"",
      "Используй текст на экране с интригой в первом кадре",
      "Первая фраза — конфликт, вопрос или неожиданный факт",
      "Обрежь первые 1–2 секунды раскачки при монтаже — темп решает всё",
    ],
  },
  trendUsage: {
    title: "Активнее используй тренды",
    tips: [
      "Заходи в тренд в первые 24–72 часа его роста, а не когда он уже везде",
      "Адаптируй тренд под свою нишу вместо копирования один в один",
      "Проверяй вкладку 'В тренде' и сохранённые звуки каждый день по 5 минут",
      "Совмещай трендовый формат со своей уникальной подачей — это и есть вирусность",
    ],
  },
  retention: {
    title: "Удерживай зрителя до конца",
    tips: [
      "Дели видео на 3 акта: обещание → развитие → payoff в конце",
      "Убирай любые провисания темпа при монтаже — смотри на кривую удержания в аналитике",
      "Используй петличный/акцентный звук на смене сцен, чтобы держать внимание",
      "Заканчивай открытым вопросом или тизером следующего видео — это увеличивает повторные просмотры",
    ],
  },
  hashtags: {
    title: "Продумай стратегию хэштегов",
    tips: [
      "Комбинируй 2–3 нишевых + 1–2 широких + 1 трендовый хэштег",
      "Не используй более 5 хэштегов — это выглядит спамно и размывает сигнал алгоритму",
      "Добавляй ключевые слова в подпись и caption — TikTok индексирует текст, не только хэштеги",
      "Проверяй охваты по каждому хэштегу и заменяй те, что не приносят просмотров",
    ],
  },
};
