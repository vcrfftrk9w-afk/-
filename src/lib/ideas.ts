import { seededRandom, pick, pickN, randInt } from "./rng";
import { Niche, getNiche } from "./niches";
import { Trend, getTrendsForNiche } from "./trends";
import { ProfileStats } from "./analysis";

export interface VideoIdea {
  id: string;
  title: string;
  hook: string;
  beats: string[];
  shotList: string[];
  audio: string;
  caption: string;
  hashtags: string[];
  bestTimeToPost: string;
  difficulty: "легко" | "средне" | "сложно";
  estMinutes: number;
  basedOnTrend?: string;
}

const HOOK_TEMPLATES = [
  "Останови скролл: {topic}",
  "То, что произошло дальше, я не ожидал(а): {topic}",
  "Никто не говорит об этом, но {topic}",
  "3 секунды, чтобы объяснить {topic}",
  "Подожди... {topic}",
  "Это изменило моё отношение к {topic}",
  "POV: ты наконец понял(а) {topic}",
  "Секрет, который я скрывал(а) про {topic}",
];

const CTA_TEMPLATES = [
  "Сохрани, чтобы не потерять",
  "Напиши в комментах своё мнение",
  "Дуэть со мной, если тоже так думаешь",
  "Отправь другу, которому это нужно",
  "Подпишись — дальше будет часть 2",
];

function fillTemplate(tpl: string, topic: string) {
  return tpl.replace("{topic}", topic);
}

export function generateIdeas(
  profile: ProfileStats,
  count = 3,
  variantSeed = 0,
): VideoIdea[] {
  const niche = getNiche(profile.niche);
  const trends = getTrendsForNiche(profile.niche);
  const rng = seededRandom(profile.username, profile.niche, "ideas", variantSeed);

  const ideas: VideoIdea[] = [];
  for (let i = 0; i < count; i++) {
    const trend: Trend = pick(rng, trends);
    const pillar = pick(rng, niche.pillars);
    const topic = `${pillar.toLowerCase()}`;
    const hook = fillTemplate(pick(rng, HOOK_TEMPLATES), topic);
    const cta = pick(rng, CTA_TEMPLATES);

    const bestSlotStr = `${profile.bestSlot.day}, ${profile.bestSlot.slot}`;

    const beats = [
      `0:00–0:03 — Хук: "${hook}"`,
      `0:03–${randInt(rng, 8, 12)} сек — Завязка: контекст в 1 предложении, без воды`,
      `Середина — Раскрытие: используй механику тренда "${trend.title}"`,
      `Последние 2–3 сек — Payoff + призыв: "${cta}"`,
    ];

    const shotList = pickN(rng, trend.howTo, Math.min(4, trend.howTo.length));

    const hashtags = Array.from(
      new Set([...pickN(rng, trend.hashtags, 3), `#${niche.id}tok`]),
    ).slice(0, 5);

    ideas.push({
      id: `${trend.id}-${i}-${variantSeed}`,
      title: `${pillar}: ${trend.title.toLowerCase()}`,
      hook,
      beats,
      shotList,
      audio: trend.audioHint,
      caption: `${hook.charAt(0).toUpperCase() + hook.slice(1)} ${pick(rng, ["✨", "🔥", "👀", "💫"])} ${cta}`,
      hashtags,
      bestTimeToPost: bestSlotStr,
      difficulty: trend.difficulty,
      estMinutes:
        trend.difficulty === "легко" ? randInt(rng, 15, 25) : trend.difficulty === "средне" ? randInt(rng, 30, 45) : randInt(rng, 50, 80),
      basedOnTrend: trend.title,
    });
  }
  return ideas;
}
