// ─────────────────────────────────────────────────────────────────────────────
// Офлайн-«мозг»: генерирует анализ, тренды, идеи, сценарии и план роста
// на основе базы знаний и метрик, когда AI-ключ не настроен или недоступен.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AIAnalysis,
  Account,
  GrowthPlan,
  LocalReport,
  PlanDay,
  PlanTask,
  ProductionPlan,
  Trend,
  TrendsResponse,
  UserSettings,
  VideoIdea,
} from "./types";
import { ALGORITHM_RULES, EVERGREEN_TRENDS, HOOK_FORMULAS, getNiche } from "./knowledge";
import type { ReviewResult } from "./prompts";
import { formatNum } from "./analytics";

const uid = () => Math.random().toString(36).slice(2, 10);
const pick = <T,>(xs: T[], i: number) => xs[((i % xs.length) + xs.length) % xs.length];
const shuffle = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5);

// ── Анализ ──────────────────────────────────────────────────────────────────
export function localAnalysis(account: Account, settings: UserSettings, report: LocalReport): AIAnalysis {
  const niche = getNiche(settings.niche);
  const weak = [...report.subScores].sort((a, b) => a.score - b.score);
  const strong = [...report.subScores].sort((a, b) => b.score - a.score);
  const f = account.profile.followers;

  const priorityMap: Record<string, AIAnalysis["priorities"][number]> = {
    reach: {
      title: "Усилить хуки первых 2 секунд",
      why: "Низкий охват относительно подписчиков: зрители листают ролик до того, как он «зацепит».",
      how: "Начинай с результата или конфликта, текст-крючок на экране в 1-й кадр, никаких приветствий. Тестируй 2 разных хука на одну идею.",
      impact: "high",
    },
    engagement: {
      title: "Провоцировать реакции",
      why: `ER ниже нормы ниши (≈${niche.benchmarkER}%).`,
      how: "Вопрос в конце, «угадай», спорный пункт, закреплённый комментарий. Отвечай на все комментарии в первый час.",
      impact: "medium",
    },
    conversation: {
      title: "Запустить обсуждения",
      why: "Мало комментариев и репостов — сильнейших сигналов для рекомендаций.",
      how: "Тир-листы, «непопулярное мнение», ответы видео на комменты, серии с продолжением.",
      impact: "medium",
    },
    consistency: {
      title: "Выйти на стабильный график",
      why: "Нерегулярные публикации тормозят обучение алгоритма.",
      how: `Снимай пачкой 1 день в неделю 5–7 роликов, выкладывай по графику в ${report.bestSlots.slice(0, 2).map((s) => s.label).join(" и ")}.`,
      impact: "high",
    },
    seo: {
      title: "Оптимизировать SEO",
      why: "TikTok работает как поисковик: без ключевых слов ролики не находят.",
      how: "Ключевая фраза в подписи + текст на экране + 3–5 точных хэштегов (1 широкий, 2 нишевых, 1–2 уникальных).",
      impact: "low",
    },
    profile: {
      title: "Упаковать профиль",
      why: "Зритель заходит в профиль и не понимает, зачем подписываться.",
      how: "Понятное имя с нишей, био «кто ты + польза + частота», 3 закреплённых лучших видео, плейлисты по рубрикам.",
      impact: "medium",
    },
  };

  return {
    summary: `Аккаунт @${account.profile.username} в нише «${niche.label}» — уровень «${report.level}» (${report.viralScore}/100). Медиана ${formatNum(report.medianViews)} просмотров, ER ${report.engagementRate.toFixed(1)}%, ${report.postsPerWeek.toFixed(1)} видео в неделю.`,
    diagnosis: `Главный рычаг роста сейчас — «${weak[0].label.toLowerCase()}» (${weak[0].score}/100). Сильная сторона — «${strong[0].label.toLowerCase()}» (${strong[0].score}/100): на ней строим контент-стратегию.`,
    strengths: strong.slice(0, 3).map((s) => `${s.label}: ${s.hint}`),
    weaknesses: weak.slice(0, 3).map((s) => `${s.label}: ${s.hint}`),
    priorities: weak.slice(0, 4).map((s) => priorityMap[s.key]).filter(Boolean),
    contentPillars: niche.pillars.map((p, i) => ({ ...p, share: [40, 25, 20, 15][i] ?? 10 })),
    profileFixes: [
      { field: "Имя", current: account.profile.displayName || "—", suggestion: `${account.profile.displayName || account.profile.username} | ${niche.label}` },
      { field: "Био", current: account.profile.bio || "пусто", suggestion: `${niche.emoji} ${niche.pillars[0].name} и ${niche.pillars[1].name.toLowerCase()} · новое видео каждый день · 👇 пиши, что снять` },
      { field: "Закреп", current: "—", suggestion: report.bestVideo ? `Закрепи «${report.bestVideo.title.slice(0, 40)}…» + 2 ролика-«визитки»` : "Закрепи 3 лучших ролика, объясняющих, о чём аккаунт" },
    ],
    hookAdvice: shuffle(HOOK_FORMULAS)
      .filter((h) => !h.template.startsWith("("))
      .slice(0, 5)
      .map((h) => `«${fillHook(h.template, niche.label.toLowerCase())}» — ${h.why.toLowerCase()}`),
    predictedFollowers30d: Math.round(f + Math.max(report.medianViews, 200) * (settings.postsPerWeek / 7) * 30 * 0.01),
    source: "local",
  };
}

// ── Тренды ──────────────────────────────────────────────────────────────────
export function localTrends(settings: UserSettings): TrendsResponse {
  const niche = getNiche(settings.niche);
  const trends: Trend[] = EVERGREEN_TRENDS.map((t) => {
    const fits = t.niches === "all" || (t.niches ?? []).includes(settings.niche);
    const { niches: _n, ...rest } = t;
    return {
      ...rest,
      id: uid(),
      nicheFit: fits ? 70 + Math.round(Math.random() * 28) : 35 + Math.round(Math.random() * 25),
      exampleIdea: `${niche.emoji} ${adaptIdea(t.exampleIdea, niche.label)}`,
      hashtags: [...t.hashtags, ...niche.hashtags.slice(0, 2)],
    };
  });
  // Нишевые форматы как «тренды ниши»
  niche.formats.slice(0, 4).forEach((f, i) => {
    const seed = niche.ideaSeeds[i % niche.ideaSeeds.length];
    trends.push({
      id: uid(),
      name: f,
      type: "format",
      description: `Один из самых стабильно заходящих форматов в нише «${niche.label}».`,
      whyItWorks: `Попадает в ожидания аудитории: ${niche.audience}.`,
      howToShoot: [
        `Хук на экране в первую секунду: «${seed.hook}».`,
        seed.concept + ".",
        "Снимай вертикально 9:16, 1080p, свет спереди, телефон на штативе.",
        "Монтаж: убери все паузы, смена кадра каждые 1.5–3 секунды, автосубтитры.",
        "В конце — вопрос или призыв к действию, в подписи — ключевые слова ниши.",
      ],
      hashtags: niche.hashtags.slice(0, 5),
      heat: 55 + Math.round(Math.random() * 25),
      lifecycle: "evergreen",
      difficulty: i % 2 ? "medium" : "easy",
      nicheFit: 90 + Math.round(Math.random() * 10),
      exampleIdea: seed.title,
    });
  });
  trends.sort((a, b) => b.nicheFit * 0.6 + b.heat * 0.4 - (a.nicheFit * 0.6 + a.heat * 0.4));
  return {
    trends,
    fetchedAt: Date.now(),
    live: false,
    origin: "local",
    note: "Офлайн-база проверенных форматов. Добавь ANTHROPIC_API_KEY, чтобы ИИ искал актуальные тренды в интернете в реальном времени.",
  };
}

function adaptIdea(text: string, nicheLabel: string) {
  return text.replace("твоей нише", `нише «${nicheLabel}»`).replace("своей ниши", `ниши «${nicheLabel}»`);
}

// ── Идеи ────────────────────────────────────────────────────────────────────
export function localIdeas(settings: UserSettings, report: LocalReport | null, trends: Trend[], count = 8): VideoIdea[] {
  const niche = getNiche(settings.niche);
  const ideas: VideoIdea[] = [];
  const seeds = shuffle(niche.ideaSeeds);
  const hooks = shuffle(HOOK_FORMULAS);
  const tr = trends.length ? trends : localTrends(settings).trends;
  const bestDuration = report?.durationBuckets.filter((b) => b.count >= 2).sort((a, b) => b.avgViews - a.avgViews)[0]?.label;

  for (let i = 0; i < count; i++) {
    const seed = pick(seeds, i);
    const trend = pick(tr, i);
    const hook = pick(hooks, i);
    const mixTrend = i % 2 === 1;
    const dur = mixTrend ? 12 + (i % 3) * 8 : [15, 25, 35, 45, 60][i % 5];
    ideas.push({
      id: uid(),
      title: mixTrend ? `${trend.name}: ${seed.title.toLowerCase()}` : seed.title,
      hook: mixTrend ? seed.hook : `${seed.hook}`,
      concept: mixTrend
        ? `Совмести формат «${trend.name}» с идеей: ${seed.concept.charAt(0).toLowerCase() + seed.concept.slice(1)}.`
        : `${seed.concept}.`,
      format: mixTrend ? trend.name : seed.format,
      trendRef: mixTrend ? trend.name : undefined,
      viralPotential: Math.min(97, Math.round(55 + (mixTrend ? trend.heat * 0.25 : 12) + Math.random() * 18)),
      effort: (["low", "medium", "low", "high"] as const)[i % 4],
      durationSec: dur,
      whyItWillWork: `${hook.why}. ${bestDuration ? `Твоя лучшая длина — ${bestDuration}.` : ""} Аудитория ниши: ${niche.audience}.`,
      hashtags: [...niche.hashtags.slice(0, 3), ...(mixTrend ? trend.hashtags.slice(0, 2) : [])],
      sound: mixTrend ? "Трендовый звук недели (проверь вкладку звуков)" : undefined,
    });
  }
  return ideas.sort((a, b) => b.viralPotential - a.viralPotential);
}

// ── Сценарий и инструкция по съёмке ─────────────────────────────────────────
export function localProductionPlan(idea: VideoIdea, settings: UserSettings, report: LocalReport | null): ProductionPlan {
  const niche = getNiche(settings.niche);
  const d = Math.max(idea.durationSec, 10);
  const seg = (a: number, b: number) => `${Math.round(a)}–${Math.round(b)}с`;
  const face = settings.faceOnCamera;
  return {
    title: idea.title,
    hookVariants: [
      idea.hook,
      `Никто не показывает это: ${idea.title.toLowerCase()}`,
      `Сохрани, пока не удалили 👀 ${idea.title}`,
    ],
    scenes: [
      { t: seg(0, 2), shot: face ? "Крупный план лица, камера на уровне глаз" : "Самый зрелищный кадр результата", action: "Сразу показываешь результат или конфликт, без приветствий", onScreenText: idea.hook },
      { t: seg(2, d * 0.3), shot: "Средний план, движение к камере", action: "Контекст: почему это важно зрителю (1 фраза)", voiceover: "Сейчас покажу, как это сделать / что будет дальше" },
      { t: seg(d * 0.3, d * 0.75), shot: "Смена ракурса каждые 1.5–3 сек: крупный → средний → детали", action: idea.concept, onScreenText: "Шаги/пункты номерами" },
      { t: seg(d * 0.75, d * 0.92), shot: "Кульминация — самый эмоциональный кадр", action: "Результат, поворот, неожиданный финал" },
      { t: seg(d * 0.92, d), shot: "Лицо в камеру / финальный кадр", action: "Призыв: вопрос в комменты или «часть 2?»", onScreenText: "Пиши 👇" },
    ],
    shotList: [
      "Кадр-хук (снять 3 дубля с разной эмоцией)",
      "Общий план локации (1–2 сек)",
      "3–5 крупных планов деталей (руки, предметы, лицо)",
      "Кадр кульминации (2 дубля)",
      "Финальный кадр с CTA",
      "Запасные B-roll кадры на 5–10 сек для перебивок",
    ],
    equipment: ["Смартфон (основная камера, 1080p 30/60fps)", "Штатив или стопка книг", face ? "Петличный микрофон (если говоришь)" : "Чистый фон без лишних предметов", "Салфетка протереть объектив"],
    lighting: "Встань лицом к окну (дневной свет спереди) или кольцевая лампа чуть выше глаз. Никакого света сзади — силуэт убивает удержание.",
    editing: [
      "CapCut: удали все паузы (Автообрезка тишины).",
      "Смена кадра каждые 1.5–3 секунды; zoom-in на ключевых словах.",
      "Автосубтитры, крупный шрифт, в безопасной зоне (не у краёв и не внизу).",
      "Звук: трендовый трек на 10–20% громкости под голос или 100% для танцев/переходов.",
      "Первый кадр = обложка: яркая эмоция + 3–5 слов текста.",
      "Закольцуй: последний кадр плавно переходит в первый — растёт пересмотр.",
    ],
    sound: idea.sound ?? "Трендовый звук с 1–50K видео и растущей динамикой (вкладка «Звуки» → Популярное)",
    caption: `${idea.hook} ${niche.emoji} А ты бы так смог(ла)? 👇`,
    hashtags: Array.from(new Set([...idea.hashtags, ...niche.hashtags.slice(0, 2)])).slice(0, 5),
    cta: "Задай вопрос в конце и закрепи свой комментарий с продолжением мысли",
    postingTime: report?.bestSlots?.[0]?.label ?? "Вт–Чт 18:00–20:00 по местному времени",
    pinnedComment: "Снять часть 2? Если наберём 100 комментов — выложу завтра 🔥",
    checklist: [
      "Хук читается за 1 секунду без звука",
      "Нет приветствия и «всем привет»",
      "Видео 9:16, 1080p, чистый объектив",
      "Субтитры в безопасной зоне",
      "Обложка с крупным текстом",
      "Подпись с ключевыми словами + 3–5 хэштегов",
      "Первый час после публикации — отвечаю на комментарии",
    ],
    mistakesToAvoid: [
      "Долгое начало и логотипы",
      "Горизонтальное видео или чёрные полосы",
      "Водяные знаки других приложений",
      "Удаление ролика, если он не выстрелил за час",
      "20+ хэштегов и #fyp как единственная стратегия",
    ],
    source: "local",
  };
}

// ── План роста на 30 дней ───────────────────────────────────────────────────
export function localGrowthPlan(settings: UserSettings, report: LocalReport | null): GrowthPlan {
  const niche = getNiche(settings.niche);
  const perDay = Math.max(1, Math.round(settings.postsPerWeek / 7));
  const days: PlanDay[] = [];
  const themes = [
    "Упаковка и старт", "Хуки", "Тренды", "Серии", "Вовлечение", "Анализ", "Контент-батч",
  ];
  for (let d = 1; d <= 30; d++) {
    const week = Math.ceil(d / 7);
    const theme = themes[(d - 1) % 7];
    const pillar = pick(niche.pillars, d);
    const seed = pick(niche.ideaSeeds, d);
    const tasks: PlanTask[] = [];
    const t = (title: string, detail: string, kind: PlanTask["kind"], xp: number) => tasks.push({ id: `d${d}-${tasks.length}`, title, detail, kind, xp });

    if (d === 1) {
      t("Упакуй профиль", "Имя с нишей, аватар с лицом крупно, био «кто ты + польза + частота», ссылка на другие соцсети.", "optimize", 50);
      t("Изучи 10 топ-авторов ниши", "Выпиши их хуки, длину роликов, форматы. Найди, что повторяется.", "learn", 30);
    }
    if (theme === "Контент-батч") {
      t("Съёмочный день", `Сними 5–7 роликов за раз: 2 × «${pillar.name}», 2 × трендовых формата, 1 × серия.`, "film", 80);
    } else {
      t(`Сними и выложи: «${seed.title}»`, `Рубрика «${pillar.name}». Хук: «${seed.hook}». ${seed.concept}.`, "film", 40);
      if (perDay > 1) t("Второй ролик дня", "Трендовый звук + адаптация под нишу (7–15 сек).", "post", 30);
    }
    t("Первый час после публикации", "Ответь на все комментарии, закрепи свой вопрос, выложи сторис.", "engage", 20);
    if (theme === "Хуки") t("Тест хуков", "Одна идея — два разных хука в двух роликах. Сравни удержание через 48 ч.", "learn", 30);
    if (theme === "Тренды") t("Найди 3 растущих звука", "Звуки с 1–50K видео. Сохрани в избранное, используй в течение 48 часов.", "learn", 25);
    if (theme === "Серии") t("Запусти серию", "Сделай «Часть 1» с клиффхэнгером и создай плейлист.", "film", 40);
    if (theme === "Вовлечение") t("Ответь видео на комментарий", "Выбери самый спорный/частый вопрос и ответь роликом.", "post", 35);
    if (theme === "Анализ") t("Разбор недели", "Открой вкладку «Анализ»: какие 2 ролика лучшие? Сделай по ним вариации.", "optimize", 30);
    if (week >= 2 && d % 7 === 0) t("Эфир (LIVE) 20–30 минут", "Если доступно: эфир в прайм-тайм, общение, анонс серии.", "live", 60);
    if (d % 3 === 0) t("10 комментариев у авторов ниши", "Содержательные комментарии у крупных авторов = бесплатный трафик в профиль.", "engage", 15);
    days.push({ day: d, theme: `Неделя ${week} · ${theme}`, tasks });
  }
  return {
    title: `30 дней до ${formatNum(Math.max(settings.goalFollowers, 1000))} подписчиков`,
    strategy: `Ниша «${niche.label}». ${settings.postsPerWeek} видео в неделю, 3–4 рубрики (${niche.pillars.map((p) => p.name).join(", ")}), обязательный вход в тренды в первые 48 часов и серии для удержания подписчиков. ${report ? `Сейчас твой главный рычаг — «${[...report.subScores].sort((a, b) => a.score - b.score)[0].label.toLowerCase()}».` : ""}`,
    phases: [
      { name: "Фундамент", days: "1–7", goal: "Упаковка, ритм публикаций, первые данные для алгоритма" },
      { name: "Поиск формулы", days: "8–14", goal: "Тест хуков и форматов, находим то, что заходит" },
      { name: "Масштаб", days: "15–23", goal: "Вариации лучших роликов, серии, тренды" },
      { name: "Ускорение", days: "24–30", goal: "Коллабы, эфиры, ответы видео, удвоение лучшего" },
    ],
    days,
    createdAt: Date.now(),
    source: "local",
  };
}

// ── Коуч (офлайн) ───────────────────────────────────────────────────────────
export function localCoachReply(message: string, settings: UserSettings, report: LocalReport | null): string {
  const m = message.toLowerCase();
  const niche = getNiche(settings.niche);
  const lines: string[] = [];
  if (/хук|начал|первые секунд|удержан/.test(m)) {
    lines.push("**Хук — это 80% успеха ролика.** Вот формулы, которые работают прямо сейчас:");
    HOOK_FORMULAS.slice(0, 6).forEach((h) => lines.push(`- **${h.name}:** «${fillHook(h.template, niche.label.toLowerCase())}» — ${h.why.toLowerCase()}`));
    lines.push("\nПравило: первый кадр = самый интересный момент видео + текст на экране, никаких приветствий.");
  } else if (/когда|время|выкладыва|постить|час/.test(m)) {
    lines.push(`**Лучшее время для тебя:** ${report?.bestSlots.map((s) => s.label).join(", ") ?? "Вт–Чт 18–20, Сб 12, Вс 20"}.`);
    lines.push("- Публикуй за 30–60 минут до пика активности, чтобы ролик успел пройти первые тестовые показы.");
    lines.push("- Первый час — отвечай на комментарии, это продлевает жизнь видео.");
  } else if (/хэштег|хештег|тег|seo|поиск/.test(m)) {
    lines.push("**Хэштеги-формула 1+2+2:** 1 широкий, 2 нишевых, 2 под конкретное видео.");
    lines.push(`Для ниши «${niche.label}»: ${niche.hashtags.slice(0, 6).join(" ")}`);
    lines.push("- Ключевые слова пиши в подписи и в тексте на экране — TikTok индексирует их для поиска.");
  } else if (/тренд|звук|музык/.test(m)) {
    lines.push("**Как ловить тренды раньше всех:**");
    lines.push("- Звуки с 1–50K видео и растущей динамикой — идеальное окно. Миллион видео — уже поздно.");
    lines.push("- Адаптируй смысл тренда под нишу, а не копируй.");
    lines.push("- Выкладывай в течение 24–48 часов после находки.");
    lines.push("- Загляни во вкладку «Тренды» — там пошаговые инструкции.");
  } else if (/не наб|мало просмотр|0 просмотр|теневой|shadow|бан|не растёт|не расту/.test(m)) {
    lines.push("**Почему мало просмотров — чек-лист:**");
    lines.push("1. Первые 2 секунды не цепляют → переделай хук.");
    lines.push("2. Ролик длиннее, чем интерес → режь всё лишнее.");
    lines.push("3. Нет ниши → алгоритм не понимает, кому показывать.");
    lines.push("4. Нерегулярность → выложи 3 видео за 3 дня.");
    lines.push("5. Водяные знаки, плохой свет, горизонталь → качество режет охват.");
    lines.push("«Теневой бан» почти всегда — это просто слабое удержание. Не удаляй ролики и не перезаливай массово.");
  } else {
    lines.push(`Вот что я советую для ниши «${niche.label}» прямо сейчас:`);
    ALGORITHM_RULES.slice(0, 5).forEach((r) => lines.push(`- ${r}`));
    if (report) lines.push(`\nТвой главный рычаг — **${[...report.subScores].sort((a, b) => a.score - b.score)[0].label}**. Открой «Анализ», там конкретные шаги.`);
  }
  lines.push("\n_Офлайн-режим. Подключи ANTHROPIC_API_KEY — и я буду отвечать как полноценный AI-продюсер с учётом всех твоих данных._");
  return lines.join("\n");
}

// ── Заполнение шаблонов хуков ───────────────────────────────────────────────
export function fillHook(template: string, topic: string): string {
  const n = () => String(3 + Math.floor(Math.random() * 5));
  return template
    .replace("{действие}", `делал(а) ${topic}`)
    .replace("{делаешь X}", `делаешь ${topic}`)
    .replace("{делай X}", `делай ${topic} так`)
    .replace(/\{N\}%/g, "97%")
    .replace(/\{N\}/g, n)
    .replace("{факт}", `${topic} работает не так, как ты думаешь`)
    .replace("{ситуация, знакомая аудитории}", `впервые пробуешь ${topic}`)
    .replace("{результат}", `прокачают твои ${topic}`)
    .replace("{последний}", "1")
    .replace("{спорное утверждение}", `${topic} переоценены`)
    .replace("{событие}", `начал(а) ${topic}`)
    .replace("{сможешь / знал}", "знал")
    .replace("{X}", `этот секрет про ${topic}`)
    .replace("{Дорого}", "Дорого")
    .replace("{дёшево}", "дёшево")
    .replace("{навыку}", topic)
    .replace("{признак аудитории}", `любишь ${topic}`)
    .replace("{название серии}", topic)
    .replace("{последствие}", "потерять подписчиков");
}

// ── Мини-инструменты ────────────────────────────────────────────────────────
export function localTool(tool: string, topic: string, settings: UserSettings): string[] {
  const niche = getNiche(settings.niche);
  const tp = topic.trim() || niche.label.toLowerCase();
  switch (tool) {
    case "hooks":
      return HOOK_FORMULAS.slice(0, 10).map((h) => fillHook(h.template, tp));
    case "captions":
      return [
        `${tp} — сохрани, чтобы не потерять 📌 ${niche.hashtags.slice(0, 3).join(" ")}`,
        `Я не ожидал(а), что ${tp} так сработает 😳 А ты пробовал(а)? 👇`,
        `Часть 1: ${tp}. Хотите продолжение? ${niche.emoji}`,
        `Поставь 🔥 если тоже любишь ${tp}`,
        `Скажи честно: ты делал(а) так? ${niche.hashtags[0]}`,
      ];
    case "hashtags":
      return [
        [niche.hashtags[0], niche.hashtags[1], `#${tp.replace(/\s+/g, "")}`, niche.hashtags[3], "#рекомендации"].join(" "),
        [niche.hashtags[2], niche.hashtags[4], `#${tp.replace(/\s+/g, "")}tips`, "#fyp", "#тренды"].join(" "),
        [niche.hashtags[5] ?? "#viral", `#${tp.replace(/\s+/g, "_")}`, niche.hashtags[0], "#foryou"].join(" "),
      ];
    case "bio":
      return [
        `${niche.emoji} ${niche.pillars[0].name} каждый день | ${tp} 👇`,
        `Помогаю с «${tp}» за 30 секунд ${niche.emoji} Новое видео ежедневно`,
        `${niche.label} без воды ⚡ Пиши, что снять следующим 👇`,
      ];
    default:
      return [];
  }
}

// ── Разбор ролика (офлайн) ──────────────────────────────────────────────────
export function localReview(
  desc: string,
  nicheId: string,
  stats?: { views?: number; likes?: number; comments?: number; shares?: number; duration?: number },
): ReviewResult {
  const niche = getNiche(nicheId);
  const hasHook = /\?|!|pov|как|почему|секрет|ошибк|никогда|часть/i.test(desc.slice(0, 80));
  const tags = (desc.match(/#\S+/g) ?? []).length;
  const er = stats?.views ? (((stats.likes ?? 0) + (stats.comments ?? 0) + (stats.shares ?? 0)) / stats.views) * 100 : null;
  const hookS = hasHook ? 70 : 40;
  const seoS = tags >= 3 && tags <= 6 ? 75 : tags ? 50 : 25;
  const engS = er === null ? 55 : Math.min(95, Math.round(er * 9));
  const lenS = stats?.duration ? (stats.duration <= 35 ? 75 : stats.duration <= 90 ? 62 : 50) : 60;
  const score = Math.round(hookS * 0.35 + engS * 0.3 + seoS * 0.15 + lenS * 0.2);
  return {
    score,
    verdict: `Потенциал ${score}/100. ${hasHook ? "Есть зацепка в начале" : "Нет явного хука в начале"}, ${tags ? `${tags} хэштегов` : "хэштегов нет"}${er !== null ? `, ER ${er.toFixed(1)}%` : ""}.`,
    scores: [
      { name: "Хук", score: hookS, comment: hasHook ? "Начало цепляет вопросом/обещанием" : "Начни с результата, конфликта или вопроса" },
      { name: "Удержание", score: lenS, comment: "Короче = выше досматриваемость. Смена кадра каждые 2–3 сек" },
      { name: "Вовлечение", score: engS, comment: er === null ? "Добавь статистику для точной оценки" : `ER ${er.toFixed(1)}% (норма ниши ≈${niche.benchmarkER}%)` },
      { name: "SEO", score: seoS, comment: "3–5 точных хэштегов + ключевые слова в подписи" },
    ],
    improvements: [
      "Первый кадр — самый интересный момент ролика + крупный текст-хук",
      "Убери приветствие и любые паузы в начале",
      "Добавь вопрос в конце и закрепи свой комментарий",
      "Субтитры в безопасной зоне экрана",
      "Закольцуй концовку с началом для пересмотров",
    ],
    betterHooks: [`Никто не говорит об этом: ${desc.slice(0, 40)}…`, "Смотри до конца — такого ты не ожидал(а)", "3 секунды, которые изменят твой взгляд на это"],
    betterCaption: `${desc.replace(/#\S+/g, "").trim().slice(0, 100)} — а ты что думаешь? 👇`,
    hashtags: niche.hashtags.slice(0, 5),
  };
}
