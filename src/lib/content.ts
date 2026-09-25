// ─────────────────────────────────────────────────────────────────────────────
// «ДНК контента»: что автор на самом деле снимает и как это работает.
// Считается по данным самого TikTok (категории роликов, поисковые слова, звук,
// голос, качество картинки, громкость, текст на экране) — без ИИ и без ручного ввода.
// ─────────────────────────────────────────────────────────────────────────────
import type { Account, ContentDNA, LocalReport, NicheId, TikTokVideo, UserSettings, VideoBreakdown, VideoFormat } from "./types";
import { er, formatNum } from "./analytics";
import { getNiche, guessNiche } from "./knowledge";

/** Категории TikTok → по-русски + ниша приложения. */
const LABELS: Record<string, { ru: string; niche?: NicheId }> = {
  comedy: { ru: "юмор", niche: "comedy" },
  "scripted comedy": { ru: "скетчи", niche: "comedy" },
  performance: { ru: "выступления", niche: "comedy" },
  entertainment: { ru: "развлечения", niche: "comedy" },
  drama: { ru: "драма", niche: "comedy" },
  "scripted drama": { ru: "постановки", niche: "comedy" },
  dance: { ru: "танцы", niche: "dance" },
  "lip-sync": { ru: "липсинк", niche: "dance" },
  music: { ru: "музыка", niche: "music" },
  "singing & instruments": { ru: "пение и инструменты", niche: "music" },
  talents: { ru: "таланты", niche: "music" },
  "daily life": { ru: "повседневная жизнь", niche: "lifestyle" },
  vlog: { ru: "влоги", niche: "lifestyle" },
  selfies: { ru: "селфи", niche: "lifestyle" },
  family: { ru: "семья", niche: "lifestyle" },
  relationship: { ru: "отношения", niche: "lifestyle" },
  "home & garden": { ru: "дом и уют", niche: "lifestyle" },
  "oddly satisfying": { ru: "сатисфай", niche: "lifestyle" },
  "life hacks": { ru: "лайфхаки", niche: "education" },
  motivation: { ru: "мотивация", niche: "lifestyle" },
  "food & drink": { ru: "еда", niche: "food" },
  food: { ru: "еда", niche: "food" },
  cooking: { ru: "готовка", niche: "food" },
  "beauty & style": { ru: "бьюти и стиль", niche: "beauty" },
  beauty: { ru: "бьюти", niche: "beauty" },
  makeup: { ru: "макияж", niche: "beauty" },
  hair: { ru: "волосы", niche: "beauty" },
  skincare: { ru: "уход за кожей", niche: "beauty" },
  fashion: { ru: "мода", niche: "fashion" },
  outfit: { ru: "образы", niche: "fashion" },
  pets: { ru: "питомцы", niche: "pets" },
  animals: { ru: "животные", niche: "pets" },
  sports: { ru: "спорт", niche: "fitness" },
  fitness: { ru: "фитнес", niche: "fitness" },
  health: { ru: "здоровье", niche: "fitness" },
  gaming: { ru: "игры", niche: "gaming" },
  games: { ru: "игры", niche: "gaming" },
  "anime & comics": { ru: "аниме и комиксы", niche: "art" },
  cosplay: { ru: "косплей", niche: "art" },
  art: { ru: "арт", niche: "art" },
  diy: { ru: "своими руками", niche: "art" },
  photography: { ru: "фото", niche: "art" },
  education: { ru: "обучение", niche: "education" },
  science: { ru: "наука", niche: "education" },
  society: { ru: "общество", niche: "education" },
  culture: { ru: "культура", niche: "education" },
  tech: { ru: "технологии", niche: "tech" },
  "science & tech": { ru: "наука и техника", niche: "tech" },
  cars: { ru: "машины", niche: "tech" },
  "auto & vehicle": { ru: "авто", niche: "tech" },
  travel: { ru: "путешествия", niche: "travel" },
  nature: { ru: "природа", niche: "travel" },
  finance: { ru: "финансы", niche: "business" },
  business: { ru: "бизнес", niche: "business" },
  "movies & tv": { ru: "кино и сериалы", niche: "comedy" },
  kids: { ru: "дети", niche: "lifestyle" },
  baby: { ru: "малыши", niche: "lifestyle" },
};

export const labelRu = (l: string) => LABELS[l.toLowerCase()]?.ru ?? l.toLowerCase();

const FORMAT_LABEL: Record<VideoFormat, string> = {
  talk: "живой голос / говоришь в кадр",
  "trend-sound": "под чужой или трендовый звук",
  "own-sound": "свой звук без речи",
  photo: "фото-карусель",
  unknown: "формат не определён",
};

export function videoFormat(v: TikTokVideo): VideoFormat {
  if (v.photo) return "photo";
  if (v.originalSound === false) return "trend-sound";
  if (v.voice === true || v.transcript) return "talk";
  if (v.originalSound === true) return "own-sound";
  return "unknown";
}

export const formatLabel = (f: VideoFormat) => FORMAT_LABEL[f];

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

function topicsOf(v: TikTokVideo): string[] {
  return Array.from(new Set((v.labels ?? []).map(labelRu)));
}

/** Разбор одного ролика: что хорошо, что мешает, что исправить. */
function breakdown(v: TikTokVideo, med: number, benchmarkER: number): VideoBreakdown {
  const perf = med > 0 ? v.views / med : 1;
  const e = er(v);
  const format = videoFormat(v);
  const signals: VideoBreakdown["signals"] = [];
  const fixes: string[] = [];

  // Подпись
  const caption = v.title.replace(/#[\p{L}\p{N}_]+/gu, "").trim();
  if (!caption) {
    signals.push({ ok: false, text: "Нет подписи" });
    fixes.push("Добавь подпись с ключевыми словами: о чём ролик простыми словами + вопрос зрителю. TikTok по ней понимает, кому показывать.");
  } else if (caption.length < 15) {
    signals.push({ ok: false, text: "Подпись слишком короткая" });
    fixes.push("Расширь подпись до 1–2 предложений: ключевое слово темы + вопрос в конце («А ты бы смог?»).");
  } else {
    signals.push({ ok: true, text: "Есть подпись" });
    if (/\?/.test(caption)) signals.push({ ok: true, text: "В подписи есть вопрос — это провоцирует комментарии" });
  }

  // Хэштеги
  const tags = v.hashtags.length;
  if (tags === 0) {
    signals.push({ ok: false, text: "Без хэштегов" });
    fixes.push("Поставь 3–5 хэштегов: 1 широкий (#рекомендации), 2 по теме, 1–2 под конкретное видео.");
  } else if (tags > 8) {
    signals.push({ ok: false, text: `Слишком много хэштегов (${tags})` });
    fixes.push("Оставь 3–5 точных хэштегов — лишние размывают, кому показывать ролик.");
  } else {
    signals.push({ ok: true, text: `${tags} ${plural(tags, "хэштег", "хэштега", "хэштегов")}` });
  }

  // Длина
  if (v.duration > 0) {
    if (v.duration < 6) {
      signals.push({ ok: false, text: `Очень короткий (${v.duration} с)` });
      fixes.push("Сделай 9–20 секунд: за 5 секунд не успевает сработать ни хук, ни развязка.");
    } else if (v.duration > 60 && perf < 1) {
      signals.push({ ok: false, text: `Длинный (${v.duration} с) при слабом охвате` });
      fixes.push("Сократи до 20–35 секунд: вырежи паузы и вступление, начни сразу с самого интересного.");
    } else {
      signals.push({ ok: true, text: `Длина ${v.duration} с` });
    }
  }

  // Картинка и звук (оценки самого TikTok)
  if (v.quality !== undefined) {
    if (v.quality < 45) {
      signals.push({ ok: false, text: `Низкое качество картинки (${v.quality}/100 по оценке TikTok)` });
      fixes.push("Протри объектив, снимай на основную (заднюю) камеру лицом к окну, в настройках — 1080p. Тёмное и мыльное видео TikTok показывает реже.");
    } else if (v.quality < 55) {
      signals.push({ ok: false, text: `Качество картинки среднее (${v.quality}/100)` });
      fixes.push("Добавь света спереди (окно или лампа) и поставь телефон на опору — картинка станет чётче.");
    } else {
      signals.push({ ok: true, text: `Хорошее качество картинки (${v.quality}/100)` });
    }
  }
  if (v.loudness !== undefined) {
    if (v.loudness < -26) {
      signals.push({ ok: false, text: "Звук тихий" });
      fixes.push("Говори ближе к телефону или подними громкость в редакторе: тихие ролики пролистывают.");
    } else {
      signals.push({ ok: true, text: "Громкость в норме" });
    }
  }
  if (v.width && v.height && v.width > v.height) {
    signals.push({ ok: false, text: "Горизонтальное видео" });
    fixes.push("Снимай вертикально 9:16 — горизонталь с чёрными полосами режет охват.");
  }
  if (v.onScreenText?.length) signals.push({ ok: true, text: `Текст на экране: «${v.onScreenText[0].slice(0, 40)}»` });

  // Время публикации
  if (v.createTime > 0) {
    const h = new Date(v.createTime * 1000).getHours();
    if (h >= 1 && h < 7) {
      signals.push({ ok: false, text: `Выложен ночью (${h}:00)` });
      fixes.push("Публикуй вечером 18:00–21:00 — в это время твоя аудитория в приложении.");
    }
  }

  // Реакция зрителей
  if (v.views >= 50) {
    if (e >= benchmarkER) signals.push({ ok: true, text: `Вовлечённость ${e.toFixed(1)}% — выше нормы` });
    else signals.push({ ok: false, text: `Вовлечённость ${e.toFixed(1)}% — ниже нормы ниши (${benchmarkER}%)` });
  }
  if (v.comments === 0 && v.views >= 100) fixes.push("В конце задай вопрос или предложи выбрать вариант («1 или 2?») — комментарии сильнее всего двигают ролик.");

  let rank: VideoBreakdown["rank"];
  let verdict: string;
  if (perf >= 1.8) {
    rank = "top";
    verdict = `Хит: в ${perf.toFixed(1)}× больше просмотров, чем у тебя обычно. Эту идею нужно повторить.`;
  } else if (perf >= 1.05) {
    rank = "good";
    verdict = `Выше твоей нормы (${formatNum(v.views)} против медианы ${formatNum(med)}).`;
  } else if (perf >= 0.6) {
    rank = "weak";
    verdict = "Около твоей нормы — зацепил, но не разогнался.";
  } else {
    rank = "flop";
    verdict = `Ниже нормы в ${(1 / Math.max(perf, 0.01)).toFixed(1)}× — зрители листали дальше в первые секунды.`;
    fixes.unshift("Переделай первые 2 секунды: начни с самого яркого момента и крупного текста-хука, без приветствия.");
  }

  return {
    id: v.id,
    rank,
    perf: Number(perf.toFixed(2)),
    format,
    formatLabel: FORMAT_LABEL[format],
    topics: topicsOf(v),
    signals,
    fixes: Array.from(new Set(fixes)).slice(0, 4),
    verdict,
  };
}

/** Сравнение сильных и слабых роликов: что у автора работает. */
function findFormula(videos: TikTokVideo[], med: number): { doMore: string[]; stopDoing: string[]; formula?: string } {
  const doMore: string[] = [];
  const stopDoing: string[] = [];
  if (videos.length < 3) return { doMore, stopDoing };
  const top = videos.filter((v) => v.views >= med);
  const low = videos.filter((v) => v.views < med);
  if (!top.length || !low.length) return { doMore, stopDoing };

  // Формат
  const byFormat = new Map<VideoFormat, number[]>();
  for (const v of videos) {
    const f = videoFormat(v);
    if (f === "unknown") continue;
    byFormat.set(f, [...(byFormat.get(f) ?? []), v.views]);
  }
  const formats = [...byFormat.entries()].filter(([, xs]) => xs.length >= 1).map(([f, xs]) => ({ f, m: median(xs), n: xs.length }));
  formats.sort((a, b) => b.m - a.m);
  let formula: string | undefined;
  if (formats.length >= 2 && formats[0].m > formats[formats.length - 1].m * 1.4) {
    const best = formats[0];
    const worst = formats[formats.length - 1];
    doMore.push(`Больше роликов в формате «${FORMAT_LABEL[best.f]}»: у тебя они набирают в ${(best.m / Math.max(worst.m, 1)).toFixed(1)}× больше, чем «${FORMAT_LABEL[worst.f]}».`);
    formula = FORMAT_LABEL[best.f];
  }

  // Длина
  const dTop = avg(top.filter((v) => v.duration > 0).map((v) => v.duration));
  const dLow = avg(low.filter((v) => v.duration > 0).map((v) => v.duration));
  if (dTop && dLow && Math.abs(dTop - dLow) >= 6) {
    if (dTop < dLow) doMore.push(`Короче — лучше: сильные ролики в среднем ${Math.round(dTop)} с, слабые — ${Math.round(dLow)} с.`);
    else doMore.push(`Твоей аудитории нравятся ролики подлиннее: сильные в среднем ${Math.round(dTop)} с против ${Math.round(dLow)} с.`);
    formula = `${formula ? `${formula}, ` : ""}~${Math.round(dTop)} с`;
  }

  // Темы (категории TikTok)
  const topicViews = new Map<string, number[]>();
  for (const v of videos) for (const t of topicsOf(v)) topicViews.set(t, [...(topicViews.get(t) ?? []), v.views]);
  const topics = [...topicViews.entries()].map(([t, xs]) => ({ t, m: median(xs), n: xs.length })).sort((a, b) => b.m - a.m);
  if (topics.length >= 2 && topics[0].m > topics[topics.length - 1].m * 1.5) {
    doMore.push(`Тема «${topics[0].t}» заходит лучше всего — сделай её основной рубрикой.`);
    stopDoing.push(`Тема «${topics[topics.length - 1].t}» пока не цепляет — меньше таких роликов или другой подход.`);
    formula = `${formula ? `${formula}, ` : ""}тема «${topics[0].t}»`;
  }

  // Подписи с вопросом
  const q = videos.filter((v) => /\?/.test(v.title));
  const nq = videos.filter((v) => !/\?/.test(v.title));
  if (q.length && nq.length && median(q.map((v) => v.comments)) > median(nq.map((v) => v.comments)) * 1.5) {
    doMore.push("Вопрос в подписи приносит тебе больше комментариев — ставь его в каждый ролик.");
  }

  // Качество
  const lowQ = videos.filter((v) => v.quality !== undefined && v.quality < 50);
  if (lowQ.length >= Math.ceil(videos.length / 2)) stopDoing.push("Снимать в темноте и на фронтальную камеру: у половины роликов TikTok оценил картинку как слабую.");
  const quiet = videos.filter((v) => v.loudness !== undefined && v.loudness < -26);
  if (quiet.length >= 2) stopDoing.push("Тихий звук: говори ближе к телефону или используй петличку.");
  return { doMore, stopDoing, formula };
}

export function buildContentDNA(account: Account, settings: UserSettings, report: LocalReport | null): ContentDNA {
  const videos = [...account.videos].sort((a, b) => b.createTime - a.createTime);
  const niche = getNiche(settings.niche);
  const med = median(videos.map((v) => v.views));
  const items = videos.map((v) => breakdown(v, med, niche.benchmarkER));

  // Темы
  const topicCount = new Map<string, number>();
  for (const v of videos) for (const t of topicsOf(v)) topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
  const topics = [...topicCount.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 6);

  // Форматы
  const fm = new Map<VideoFormat, number[]>();
  for (const v of videos) fm.set(videoFormat(v), [...(fm.get(videoFormat(v)) ?? []), v.views]);
  const formats = [...fm.entries()]
    .filter(([f]) => f !== "unknown")
    .map(([key, xs]) => ({ key, label: FORMAT_LABEL[key], count: xs.length, avgViews: Math.round(avg(xs)) }))
    .sort((a, b) => b.count - a.count);

  // Ключевые слова (как TikTok понимает твои ролики)
  const kw = new Map<string, number>();
  for (const v of videos) for (const k of v.keywords ?? []) kw.set(k.toLowerCase(), (kw.get(k.toLowerCase()) ?? 0) + 1);
  const uname = account.profile.username.toLowerCase();
  const keywords = [...kw.entries()]
    .filter(([k]) => !k.includes(uname))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 10);

  const qs = videos.map((v) => v.quality).filter((x): x is number => x !== undefined);
  const ls = videos.map((v) => v.loudness).filter((x): x is number => x !== undefined);
  const durs = videos.map((v) => v.duration).filter((d) => d > 0);
  const { doMore, stopDoing, formula } = findFormula(videos, med);

  // Ниша по категориям TikTok
  const nicheScore = new Map<NicheId, number>();
  for (const v of videos) for (const l of v.labels ?? []) {
    const n = LABELS[l.toLowerCase()]?.niche;
    if (n) nicheScore.set(n, (nicheScore.get(n) ?? 0) + 1);
  }
  const suggestedNiche = [...nicheScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  // Итоговое описание «что ты снимаешь»
  const parts: string[] = [];
  if (!videos.length) {
    parts.push("Роликов пока нет или они закрыты — начнём с нуля, и первые видео я помогу сделать правильно.");
  } else {
    const n = videos.length;
    parts.push(
      topics.length
        ? `Ты снимаешь ${topics.slice(0, 3).map((t) => t.label).join(", ")} — так твои ролики классифицирует сам TikTok.`
        : `Я посмотрел ${n} ${plural(n, "ролик", "ролика", "роликов")}: TikTok пока не присвоил им чёткую категорию — значит, тема аккаунта ещё не читается.`,
    );
    if (formats.length) {
      const f = formats[0];
      parts.push(`Основной формат — ${f.label} (${f.count} из ${n}).`);
    }
    if (durs.length) parts.push(`Средняя длина — ${Math.round(avg(durs))} с.`);
    const best = [...videos].sort((a, b) => b.views - a.views)[0];
    if (best && best.views > 0) parts.push(`Лучше всего зашёл «${(best.title.replace(/#[\p{L}\p{N}_]+/gu, "").trim() || "ролик без подписи").slice(0, 60)}» — ${formatNum(best.views)} просмотров.`);
  }

  // Советы для маленького аккаунта
  const small = account.profile.followers < 1000 || videos.length < 10;
  if (small) {
    doMore.unshift("Публикуй по 1 ролику каждый день 14 дней подряд — алгоритму нужно 10–20 видео, чтобы понять, кому тебя показывать.");
    if (!topics.length || topics.length > 3) doMore.push("Выбери 1–2 темы и держись их: сейчас TikTok не понимает, о чём аккаунт.");
  }
  if (report && report.daysSinceLastPost !== null && report.daysSinceLastPost > 3) {
    stopDoing.unshift(`Делать перерывы: последний ролик был ${report.daysSinceLastPost} дн. назад — аккаунт остывает.`);
  }

  return {
    summary: parts.join(" "),
    topics,
    formats,
    keywords,
    avgDuration: Math.round(avg(durs)),
    quality: qs.length ? Math.round(avg(qs)) : undefined,
    loudness: ls.length ? Number(avg(ls).toFixed(1)) : undefined,
    formula,
    doMore: doMore.slice(0, 5),
    stopDoing: stopDoing.slice(0, 4),
    videos: items,
    suggestedNiche,
  };
}

/**
 * Ниша по роликам: сначала категории, которые присвоил сам TikTok
 * (самый надёжный сигнал), затем подписи, хэштеги и био.
 */
export function detectNiche(videos: TikTokVideo[], bio = ""): NicheId | null {
  const score = new Map<NicheId, number>();
  for (const v of videos) {
    for (const l of new Set(v.labels ?? [])) {
      const n = LABELS[l.toLowerCase()]?.niche;
      if (n) score.set(n, (score.get(n) ?? 0) + 1 + Math.log10(1 + v.views) / 2);
    }
  }
  const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 1.5) return best[0];
  const withKeywords = videos.map((v) => ({ ...v, title: `${v.title} ${(v.keywords ?? []).join(" ")}` }));
  return guessNiche(withKeywords, bio);
}

/** Короткая сводка контента для промптов ИИ. */
export function dnaBrief(dna: ContentDNA): string {
  const lines = [`ЧТО АВТОР СНИМАЕТ (по данным TikTok): ${dna.summary}`];
  if (dna.formats.length) lines.push(`ФОРМАТЫ: ${dna.formats.map((f) => `${f.label} — ${f.count} шт, ср. ${formatNum(f.avgViews)} просм.`).join("; ")}.`);
  if (dna.keywords.length) lines.push(`ПОИСКОВЫЕ СЛОВА TIKTOK ПО РОЛИКАМ: ${dna.keywords.join(", ")}.`);
  if (dna.quality !== undefined) lines.push(`КАЧЕСТВО КАРТИНКИ (оценка TikTok): ${dna.quality}/100.${dna.loudness !== undefined ? ` Громкость: ${dna.loudness} LUFS.` : ""}`);
  if (dna.formula) lines.push(`ЧТО РАБОТАЕТ: ${dna.formula}.`);
  if (dna.doMore.length) lines.push(`ДЕЛАТЬ БОЛЬШЕ: ${dna.doMore.join(" ")}`);
  if (dna.stopDoing.length) lines.push(`ПЕРЕСТАТЬ: ${dna.stopDoing.join(" ")}`);
  return lines.join("\n");
}
