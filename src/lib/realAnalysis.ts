import { Niche, getNiche } from "./niches";
import { TRENDS } from "./trends";
import {
  ProfileStats,
  Metric,
  ContentPillar,
  HeatCell,
  GrowthPoint,
  METRIC_META,
  computeGrowthScoreAndTier,
  pickWeakStrong,
  clamp,
  DAYS,
  SLOTS,
} from "./analysis";

export interface RealVideoEntry {
  id: string;
  postedAt: string; // datetime-local value, e.g. "2026-09-10T18:30"
  views: number;
  likes: number;
  comments: number;
  shares: number;
  topic?: string; // free text / hashtags, used to refine pillars & trend/hashtag scoring
}

export interface RealProfileInput {
  username: string;
  niche: Niche;
  followers: number;
  followersLastMonth?: number;
  videos: RealVideoEntry[];
}

const SLOT_RANGES: { label: string; start: number; end: number }[] = [
  { label: SLOTS[0], start: 6, end: 10 },
  { label: SLOTS[1], start: 10, end: 14 },
  { label: SLOTS[2], start: 14, end: 18 },
  { label: SLOTS[3], start: 18, end: 22 },
  { label: SLOTS[4], start: 22, end: 30 }, // wraps past midnight (22:00–02:00)
];

function dayLabel(date: Date): string {
  const idx = (date.getDay() + 6) % 7; // JS: Sun=0..Sat=6 -> Пн=0..Вс=6
  return DAYS[idx];
}

function slotLabel(date: Date): string {
  const h = date.getHours();
  for (const s of SLOT_RANGES) {
    if (h >= s.start && h < s.end) return s.label;
    if (s.end > 24 && h < s.end - 24) return s.label;
  }
  return SLOTS[0];
}

function engagementRateOf(v: RealVideoEntry): number {
  if (v.views <= 0) return 0;
  return ((v.likes + v.comments + v.shares) / v.views) * 100;
}

function scoreHashtagCount(avgCount: number): number {
  if (avgCount <= 0) return 20;
  if (avgCount >= 2 && avgCount <= 5) return 90;
  if (avgCount < 2) return Math.round(40 + avgCount * 25);
  return Math.max(30, Math.round(90 - (avgCount - 5) * 10));
}

function extractHashtags(topic: string | undefined): string[] {
  if (!topic) return [];
  return (topic.toLowerCase().match(/#[\wа-яё\d_]+/giu) || []).map((h) => h.toLowerCase());
}

export function analyzeRealProfile(input: RealProfileInput): ProfileStats {
  const clean = input.username.trim().replace(/^@/, "").toLowerCase() || "creator";
  const niche = input.niche;
  const nicheInfo = getNiche(niche);

  const validVideos = [...input.videos]
    .filter((v) => v.postedAt && v.views > 0)
    .sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
  const n = validVideos.length;

  const sumField = (f: (v: RealVideoEntry) => number) =>
    validVideos.reduce((acc, v) => acc + f(v), 0);

  const avgViews = n ? Math.round(sumField((v) => v.views) / n) : 0;
  const avgLikes = n ? Math.round(sumField((v) => v.likes) / n) : 0;
  const avgComments = n ? Math.round(sumField((v) => v.comments) / n) : 0;
  const avgShares = n ? Math.round(sumField((v) => v.shares) / n) : 0;
  const engagementRate = avgViews > 0
    ? Number((((avgLikes + avgComments + avgShares) / avgViews) * 100).toFixed(1))
    : 0;

  let postsPerWeek = 0;
  if (n >= 2) {
    const first = new Date(validVideos[0].postedAt).getTime();
    const last = new Date(validVideos[n - 1].postedAt).getTime();
    const spanDays = Math.max(1, (last - first) / 86_400_000);
    postsPerWeek = ((n - 1) / spanDays) * 7;
  }

  const hasTopicData = validVideos.some((v) => extractHashtags(v.topic).length > 0);
  const knownTrendTags = new Set(TRENDS.flatMap((t) => t.hashtags.map((h) => h.toLowerCase())));
  let trendMatchCount = 0;
  const hashtagCounts: number[] = [];
  validVideos.forEach((v) => {
    const tags = extractHashtags(v.topic);
    hashtagCounts.push(tags.length);
    if (tags.some((t) => knownTrendTags.has(t))) trendMatchCount++;
  });
  const avgHashtagCount = hashtagCounts.length
    ? hashtagCounts.reduce((a, b) => a + b, 0) / hashtagCounts.length
    : 0;

  const engagementScore = clamp(Math.round(engagementRate * 6));
  const consistencyScore = clamp(Math.round(postsPerWeek * 9));
  const hashtagScore = hasTopicData ? clamp(scoreHashtagCount(avgHashtagCount)) : 50;
  const trendScore = hasTopicData ? clamp(Math.round((trendMatchCount / n) * 100)) : 50;
  // Neither TikTok's public profile nor a viewer can see per-video watch-time
  // or "3-second retention" — only the creator's own TikTok Studio shows that.
  // Without it we fall back to a transparent proxy (engagement-weighted) and
  // mark it `estimated` in the UI rather than pretending it's measured.
  const retentionProxy = clamp(Math.round(engagementScore * 0.75 + consistencyScore * 0.25));

  const metrics: Metric[] = [
    {
      key: "engagement",
      label: METRIC_META.engagement.label,
      icon: METRIC_META.engagement.icon,
      value: engagementScore,
      estimated: n === 0,
    },
    {
      key: "consistency",
      label: METRIC_META.consistency.label,
      icon: METRIC_META.consistency.icon,
      value: consistencyScore,
      estimated: n < 2,
    },
    {
      key: "hook",
      label: METRIC_META.hook.label,
      icon: METRIC_META.hook.icon,
      value: retentionProxy,
      estimated: true,
    },
    {
      key: "trendUsage",
      label: METRIC_META.trendUsage.label,
      icon: METRIC_META.trendUsage.icon,
      value: trendScore,
      estimated: !hasTopicData,
    },
    {
      key: "retention",
      label: METRIC_META.retention.label,
      icon: METRIC_META.retention.icon,
      value: retentionProxy,
      estimated: true,
    },
    {
      key: "hashtags",
      label: METRIC_META.hashtags.label,
      icon: METRIC_META.hashtags.icon,
      value: hashtagScore,
      estimated: !hasTopicData,
    },
  ];

  const { growthScore, tier } = computeGrowthScoreAndTier(metrics);
  const { weakPoints, strongPoints } = pickWeakStrong(metrics);

  // Content pillars: bucket videos by matching their topic/hashtag text
  // against each niche pillar's own name keywords. No signal -> honest
  // equal split instead of a fabricated distribution.
  const pillarCounts = nicheInfo.pillars.map(() => 0);
  let anyPillarMatch = false;
  if (hasTopicData) {
    validVideos.forEach((v) => {
      const text = (v.topic || "").toLowerCase();
      nicheInfo.pillars.forEach((pillarName, i) => {
        const keywords = pillarName
          .toLowerCase()
          .split(/[\s/]+/)
          .filter((w) => w.length > 3);
        if (keywords.some((kw) => text.includes(kw))) {
          pillarCounts[i]++;
          anyPillarMatch = true;
        }
      });
    });
  }
  const idealShare = Math.round(100 / nicheInfo.pillars.length);
  let contentPillars: ContentPillar[];
  if (anyPillarMatch) {
    const totalMatches = pillarCounts.reduce((a, b) => a + b, 0);
    contentPillars = nicheInfo.pillars.map((name, i) => ({
      name,
      share: Math.round((pillarCounts[i] / totalMatches) * 100),
      idealShare,
    }));
    const drift = 100 - contentPillars.reduce((a, p) => a + p.share, 0);
    contentPillars[0].share += drift;
  } else {
    contentPillars = nicheInfo.pillars.map((name) => ({
      name,
      share: idealShare,
      idealShare,
    }));
  }

  // Posting heatmap: real videos bucketed by weekday/time-slot, cell value =
  // average engagement rate of videos actually posted in that slot. Empty
  // cells carry sampleCount 0 so the UI can render them as "no data" instead
  // of implying zero engagement.
  const buckets = new Map<string, { sumRate: number; count: number }>();
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      buckets.set(`${day}|${slot}`, { sumRate: 0, count: 0 });
    }
  }
  validVideos.forEach((v) => {
    const d = new Date(v.postedAt);
    if (Number.isNaN(d.getTime())) return;
    const key = `${dayLabel(d)}|${slotLabel(d)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sumRate += engagementRateOf(v);
      bucket.count++;
    }
  });

  const heatmap: HeatCell[] = [];
  let bestSlot = { day: DAYS[0], slot: SLOTS[0] };
  let bestVal = -1;
  let bestSampleCount = 0;
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      const bucket = buckets.get(`${day}|${slot}`)!;
      const avgRate = bucket.count ? bucket.sumRate / bucket.count : 0;
      const value = bucket.count ? clamp(Math.round(avgRate * 6)) : 0;
      heatmap.push({ day, slot, value, sampleCount: bucket.count });
      if (bucket.count > 0 && (value > bestVal || (value === bestVal && bucket.count > bestSampleCount))) {
        bestVal = value;
        bestSampleCount = bucket.count;
        bestSlot = { day, slot };
      }
    }
  }

  // Growth chart: TikTok doesn't expose historical follower counts publicly,
  // so instead of inventing a trend line we plot real per-video views over
  // time — an honest, actually-measured signal. The Dashboard adapts the
  // chart's title/axis label based on `dataMode`.
  const growthHistory: GrowthPoint[] = validVideos.map((v) => {
    const d = new Date(v.postedAt);
    const label = Number.isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
    return { label, followers: v.views };
  });

  const followersLastMonth = input.followersLastMonth ?? input.followers;
  const projectedDaysTo: { milestone: number; days: number }[] = [];
  if (input.followersLastMonth && input.followersLastMonth > 0 && input.followers > input.followersLastMonth) {
    const weeklyGrowthRate = Math.pow(input.followers / input.followersLastMonth, 1 / 4) - 1;
    const safeRate = Math.max(weeklyGrowthRate, 0.004);
    const milestones = [1000, 5000, 10000, 50000, 100000, 1000000].filter((m) => m > input.followers);
    milestones.slice(0, 3).forEach((milestone) => {
      const weeksNeeded = Math.log(milestone / input.followers) / Math.log(1 + safeRate);
      projectedDaysTo.push({ milestone, days: Math.max(3, Math.round(weeksNeeded * 7)) });
    });
  }

  return {
    username: clean,
    niche,
    dataMode: "real",
    followers: input.followers,
    followersLastMonth,
    avgViews,
    avgLikes,
    engagementRate,
    postsPerWeek: Math.round(postsPerWeek * 10) / 10,
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
