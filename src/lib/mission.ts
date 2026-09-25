// ─────────────────────────────────────────────────────────────────────────────
// Миссия дня: одно конкретное видео с пошаговой инструкцией.
// Автору остаётся только выполнить шаги по порядку.
// Офлайн-версия: опирается на ДНК контента, лучший ролик, тренды и нишу.
// ─────────────────────────────────────────────────────────────────────────────
import type { Account, ContentDNA, DeepAnalysis, LocalReport, Mission, Trend, TikTokVideo, UserSettings } from "./types";
import { formatNum } from "./analytics";
import { EVERGREEN_TRENDS, HOOK_FORMULAS, getNiche } from "./knowledge";
import { fillHook } from "./offline";

const uid = () => Math.random().toString(36).slice(2, 10);
const pick = <T,>(xs: T[], i: number) => xs[((i % xs.length) + xs.length) % xs.length];
const clean = (t: string) => t.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();

/** Когда выложить: лучший слот из данных автора или ближайший вечер. */
export function nextPostTime(report: LocalReport | null): string {
  const now = new Date();
  if (report?.slotsFromData && report.heatmap.length >= 8 && report.bestSlots[0]) {
    const s = report.bestSlots[0];
    return `${s.label} (твоё лучшее время по данным)`;
  }
  const h = now.getHours();
  if (h < 18) return "Сегодня в 19:00";
  if (h < 21) return "Сегодня в течение часа (до 21:00)";
  return "Завтра в 19:00";
}

function kindFor(n: number, videos: TikTokVideo[], best: TikTokVideo | undefined, hasComments: boolean): Mission["kind"] {
  if (!videos.length && n === 1) return "starter";
  const seq: Mission["kind"][] = best ? ["repeat-best", "trend", "seed", "series", "trend", "reply"] : ["seed", "trend", "series", "trend", "reply"];
  const k = pick(seq, n - 1);
  return k === "reply" && !hasComments ? "seed" : k;
}

export function localMission(opts: {
  account: Account;
  settings: UserSettings;
  report: LocalReport | null;
  dna: ContentDNA;
  trends: Trend[];
  deep?: DeepAnalysis | null;
  number: number;
  shift?: number; // «другая идея» — сдвиг выбора при том же номере миссии
}): Mission {
  const { account, settings, report, dna, trends, deep } = opts;
  const n = opts.number + (opts.shift ?? 0);
  const niche = getNiche(settings.niche);
  const videos = account.videos;
  const med = report?.medianViews ?? 0;
  const bestV = [...videos].sort((a, b) => b.views - a.views)[0];
  const best = bestV && videos.length >= 2 && bestV.views > Math.max(med * 1.3, 30) ? bestV : undefined;
  const hasComments = videos.some((v) => v.comments > 0);
  const kind = kindFor(n, videos, best, hasComments);
  const topic = dna.topics[0]?.label ?? niche.label.toLowerCase();
  const mainFormat = dna.formats[0]?.key;
  const face = settings.faceOnCamera;
  const hookF = pick(
    HOOK_FORMULAS.filter((h) => !h.template.startsWith("(")),
    n * 3 + 1,
  );

  let title = "";
  let why = "";
  let basedOn: string | undefined;
  let format = "";
  let hook = "";
  let concept = "";
  let duration = 15;
  let sound = mainFormat === "talk" ? "Свой голос + тихая фоновая музыка (10–15% громкости)" : "Трендовый звук недели: вкладка «Звуки» → «Популярное», выбирай звук с 1–50 тыс. видео";
  let hashtags = niche.hashtags.slice(0, 3);
  let trendSteps: string[] = [];

  switch (kind) {
    case "starter": {
      title = "Ролик-знакомство: кто ты и зачем на тебя подписываться";
      format = "Визитка";
      hook = `Я ${face ? "" : "здесь, чтобы "}${niche.pillars[0].name.toLowerCase()} — вот что будет на этом канале`;
      concept = `Покажи в 3–4 быстрых кадрах, что будет в аккаунте (${niche.pillars.map((p) => p.name.toLowerCase()).slice(0, 3).join(", ")}), и чем ты отличаешься.`;
      why = "Первый ролик задаёт тему аккаунта: по нему TikTok решает, кому тебя показывать, а новые зрители — подписываться ли.";
      duration = 15;
      break;
    }
    case "repeat-best": {
      const bt = clean(best!.title) || "твой лучший ролик";
      const perf = med > 0 ? best!.views / med : 2;
      title = `Новая версия твоего хита: «${bt.slice(0, 50)}»`;
      format = "Повтор формулы лучшего ролика";
      basedOn = `Ролик «${bt.slice(0, 60)}» набрал ${formatNum(best!.views)} просмотров — в ${perf.toFixed(1)}× больше твоей нормы.`;
      why = "Алгоритм уже показал, что эта идея нравится зрителям. Повторить формулу с новым поворотом — самый надёжный способ получить второй хит.";
      hook = `${bt.replace(/[.!?…]+$/u, "").slice(0, 55)} — часть 2`;
      concept = `Возьми ту же идею и подачу, что в «${bt.slice(0, 50)}», но с новой ситуацией/концовкой. Первый кадр — самый яркий момент.`;
      duration = best!.duration > 0 ? Math.min(Math.max(best!.duration, 9), 45) : 15;
      if (best!.sound) sound = best!.originalSound === false ? `Тот же тип звука, что в хите: «${best!.sound}» или похожий трендовый` : sound;
      hashtags = Array.from(new Set([...best!.hashtags.slice(0, 3), ...niche.hashtags.slice(0, 2)])).slice(0, 5);
      break;
    }
    case "trend": {
      const pool = (trends.length ? trends : EVERGREEN_TRENDS.map((t, i) => ({ ...t, id: `e${i}`, nicheFit: t.niches === "all" || (t.niches ?? []).includes(settings.niche) ? 85 : 50 }))) as (Trend & { nicheFit: number })[];
      const sorted = [...pool].sort((a, b) => b.nicheFit + b.heat - (a.nicheFit + a.heat));
      const t = pick(sorted.slice(0, 6), Math.floor(n / 2));
      title = `Тренд «${t.name}» в твоей теме (${topic})`;
      format = t.name;
      basedOn = `Тренд: ${t.name}${t.sound ? ` · звук «${t.sound}»` : ""}`;
      why = `${t.whyItWorks} Ранний вход в тренд даёт бесплатный охват — TikTok группирует такие ролики и показывает их вместе.`;
      hook = t.exampleIdea ? clean(t.exampleIdea).slice(0, 90) : fillHook(hookF.template, topic);
      concept = t.description;
      trendSteps = t.howToShoot;
      if (t.sound) sound = t.sound;
      hashtags = Array.from(new Set([...t.hashtags.slice(0, 3), ...niche.hashtags.slice(0, 2)])).slice(0, 5);
      duration = t.difficulty === "easy" ? 12 : 18;
      break;
    }
    case "series": {
      const seed = pick(niche.ideaSeeds, n + 2);
      title = `Серия «${seed.title}» — часть 1`;
      format = "Серия с продолжением";
      why = "Серии заставляют заходить в профиль за следующей частью — это главный способ превращать просмотры в подписчиков.";
      hook = `Часть 1: ${seed.hook}`;
      concept = `${seed.concept}. Закончи на самом интересном месте: «продолжение — в части 2».`;
      duration = 20;
      break;
    }
    case "reply": {
      const withC = [...videos].sort((a, b) => b.comments - a.comments)[0];
      title = "Ответ видео на комментарий";
      format = "Ответ на комментарий";
      basedOn = withC ? `Под роликом «${(clean(withC.title) || "без подписи").slice(0, 50)}» ${withC.comments} комм.` : undefined;
      why = "Ответ видео на комментарий показывают тем, кто видел исходный ролик, и он провоцирует новые комментарии — самый сильный сигнал для алгоритма.";
      hook = "Ты спросил(а) — отвечаю 👇";
      concept = "Открой свой ролик → комментарии → выбери вопрос или спорный комментарий → «Ответить видео». Повтори вопрос своими словами и дай конкретный ответ/демонстрацию.";
      duration = 20;
      break;
    }
    default: {
      const d = deep?.nextVideos?.length ? pick(deep.nextVideos, n) : null;
      const seed = pick(niche.ideaSeeds, n);
      title = d ? d.title : seed.title;
      format = seed.format;
      why = d ? d.why : `Этот формат стабильно заходит в нише «${niche.label}»: ${niche.audience}.`;
      hook = d ? d.hook : seed.hook;
      concept = d ? `${d.title}. ${d.why}` : `${seed.concept}.`;
      duration = mainFormat === "talk" ? 25 : 15;
    }
  }

  const onScreenText = clean(hook).slice(0, 60);
  const d = duration;
  const seg = (a: number, b: number) => `${Math.round(a)}–${Math.round(b)} с`;
  const shots: Mission["shots"] = [
    {
      t: seg(0, 2),
      what: face ? "Крупный план лица, телефон на уровне глаз. Сразу эмоция и самый яркий момент — без «привет»." : "Самый зрелищный кадр ролика (результат/кульминация) — сразу, без вступления.",
      say: hook,
    },
    { t: seg(2, d * 0.35), what: "Смена ракурса: средний план. Коротко — в чём ситуация/задача.", say: "1 фраза контекста: почему это важно/смешно/полезно" },
    { t: seg(d * 0.35, d * 0.8), what: concept, say: mainFormat === "talk" ? "Главная часть — короткими фразами, меняй кадр каждые 2–3 секунды" : undefined },
    { t: seg(d * 0.8, d * 0.95), what: "Кульминация или неожиданный поворот — самый эмоциональный кадр." },
    { t: seg(d * 0.95, d), what: "Финал: взгляд в камеру или последний кадр, который плавно переходит в первый (для пересмотров).", say: kind === "series" ? "«Часть 2 — если наберём 50 комментариев»" : "Вопрос зрителю: «А ты бы как сделал(а)?»" },
  ];

  const prep = [
    "Телефон на штатив или стопку книг, вертикально 9:16, основная (задняя) камера, 1080p.",
    face ? "Встань лицом к окну или лампе — свет спереди, не сзади." : "Подготовь кадры без лица: руки, предметы, экран, вид от первого лица.",
    "Протри объектив, убери лишнее из фона.",
    ...(dna.quality !== undefined && dna.quality < 55 ? [`TikTok оценил качество твоих роликов на ${dna.quality}/100 — сегодня обязательно дневной свет и чистый объектив.`] : []),
    ...(dna.loudness !== undefined && dna.loudness < -26 ? ["Твои ролики звучат тихо — говори ближе к телефону или громче."] : []),
    ...trendSteps.slice(0, 2),
  ];

  const edit = [
    "Открой CapCut (или редактор TikTok) → вырежи все паузы и «э-э» (Автообрезка тишины).",
    "Меняй кадр каждые 2–3 секунды; на ключевых словах — лёгкий zoom.",
    `Первый кадр: крупный текст «${onScreenText}» в верхней трети экрана (не у краёв).`,
    "Включи автосубтитры — большинство смотрит без звука.",
    sound.startsWith("Свой") ? "Музыку подложи тихо (10–15%), чтобы голос был главным." : "Добавь звук прямо в TikTok (не в CapCut) — так ролик попадёт в ленту этого звука.",
    ...trendSteps.slice(2, 4),
  ];

  const question = kind === "series" ? "Снимать часть 2?" : "А ты бы так смог(ла)?";
  const caption = `${clean(hook).replace(/[👇🔥]/gu, "").trim()} ${niche.emoji} ${question} 👇`;

  const afterPost = [
    "Первые 60 минут — отвечай на каждый комментарий (лучше вопросом, чтобы разговор продолжился).",
    `Закрепи свой комментарий: «${kind === "series" ? "Часть 2 выйдет завтра — напиши «+» чтобы не пропустить" : "Какой снять следующим? Пиши идеи 👇"}».`,
    "Не удаляй ролик, даже если сначала мало просмотров — ролики часто разгоняются через 1–3 дня.",
    "Завтра вернись сюда и нажми «Обновить данные» — я посмотрю, как зашёл ролик, и дам следующую миссию.",
  ];

  const bonus: string[] = [];
  const bio = account.profile.bio ?? "";
  if (bio.trim().length < 20) bonus.push(`Замени био на: «${niche.emoji} ${niche.pillars[0].name} и ${niche.pillars[1].name.toLowerCase()} · новое видео каждый день 👇»`);
  if (!account.profile.avatarUrl) bonus.push("Поставь аватар с лицом крупным планом — так подписываются чаще.");

  return {
    id: uid(),
    number: opts.number,
    createdAt: Date.now(),
    kind,
    title,
    why,
    basedOn,
    format,
    durationSec: duration,
    hook,
    onScreenText,
    prep: Array.from(new Set(prep)).slice(0, 6),
    shots,
    edit: Array.from(new Set(edit)).slice(0, 7),
    caption,
    hashtags: Array.from(new Set(hashtags)).slice(0, 5),
    sound,
    postAt: nextPostTime(report),
    afterPost,
    bonus: bonus.length ? bonus : undefined,
    source: "local",
  };
}

/** Офлайн-версия глубокого разбора: из ДНК контента. */
export function localDeep(dna: ContentDNA, account: Account, settings: UserSettings): DeepAnalysis {
  const niche = getNiche(settings.niche);
  const byId = new Map(account.videos.map((v) => [v.id, v]));
  const bestB = [...dna.videos].sort((a, b) => b.perf - a.perf)[0];
  const bestV = bestB ? byId.get(bestB.id) : undefined;
  return {
    whatYouFilm: dna.summary,
    style: dna.formats.length ? `Чаще всего: ${dna.formats.map((f) => f.label).join(", ")}. Средняя длина ${dna.avgDuration || "—"} с.` : "Формат роликов пока не определить — нужно больше видео.",
    audience: niche.audience,
    strongest: bestV ? `Лучший ролик — «${(clean(bestV.title) || "без подписи").slice(0, 60)}» (${formatNum(bestV.views)} просмотров). ${bestB.verdict}` : "Сильную сторону покажут первые 5–10 роликов.",
    formula: dna.formula ? `Твоя формула: ${dna.formula}.` : "Формула появится после 5+ роликов — пока держись одной темы и публикуй каждый день.",
    videos: dna.videos.map((b) => {
      const v = byId.get(b.id);
      return {
        id: b.id,
        inside: v ? [b.topics.join(", "), b.formatLabel, v.transcript ? `говоришь: «${v.transcript.slice(0, 80)}…»` : ""].filter(Boolean).join(" · ") : b.formatLabel,
        hook: v?.onScreenText?.[0] ? `Текст на экране: «${v.onScreenText[0]}»` : "Хук по данным TikTok не виден — проверь, есть ли текст и действие в первую секунду.",
        whyResult: b.verdict,
        fix: b.fixes[0] ?? "Держи тот же уровень и тестируй новые хуки.",
      };
    }),
    more: dna.doMore,
    stop: dna.stopDoing,
    nextVideos: niche.ideaSeeds.slice(0, 3).map((s) => ({ title: s.title, hook: s.hook, why: s.concept })),
    createdAt: Date.now(),
    source: "local",
  };
}
