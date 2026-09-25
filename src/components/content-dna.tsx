"use client";
// «Что ты снимаешь» и разбор каждого ролика: по данным TikTok + (если есть) глубокий разбор ИИ по обложкам.
import { motion } from "framer-motion";
import { ArrowRight, Ban, CheckCircle2, ExternalLink, Eye, Heart, MessageCircle, Mic, Music2, Repeat2, ScanSearch, Sparkles, Video, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useActions, useBusy } from "@/lib/actions";
import { formatNum } from "@/lib/analytics";
import { labelRu } from "@/lib/content";
import type { TikTokVideo, VideoBreakdown } from "@/lib/types";
import { Button, Card, Chip, Progress, Thinking, cn } from "./ui";
import { useNav } from "./nav";

const RANK: Record<VideoBreakdown["rank"], { t: string; tone: "lime" | "cyan" | "amber" | "pink" }> = {
  top: { t: "🔥 Хит", tone: "lime" },
  good: { t: "Выше нормы", tone: "cyan" },
  weak: { t: "Около нормы", tone: "amber" },
  flop: { t: "Не зашёл", tone: "pink" },
};

/** Запуск глубокого разбора ИИ один раз, когда ИИ доступен. */
function useAutoDeep() {
  const { state, status } = useStore();
  const { runDeep } = useActions();
  const once = useRef(false);
  useEffect(() => {
    if (once.current || !status?.ai || state.deep || !state.account?.videos.length) return;
    once.current = true;
    runDeep(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.ai, state.deep]);
}

function Cover({ v, className }: { v: TikTokVideo; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!v.coverUrl || broken) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl bg-white/5", className)}>
        <Video className="size-5 text-white/30" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={v.coverUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn("rounded-xl object-cover", className)} />;
}

/** Карточка для «Обзора»: что ты снимаешь + что работает. */
export function ContentSummary({ compact }: { compact?: boolean }) {
  const { state, dna, status } = useStore();
  const { runDeep } = useActions();
  const busy = useBusy("deep");
  const { go } = useNav();
  useAutoDeep();
  if (!dna) return null;
  const deep = state.deep;
  const ai = deep?.source === "ai";

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-16 -top-16 size-48 rounded-full bg-cyan/15 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <ScanSearch className="size-5 text-cyan" /> Что ты снимаешь
          </div>
          <Chip tone={ai ? "lime" : "default"}>{ai ? "ИИ посмотрел ролики" : "По данным TikTok"}</Chip>
        </div>

        {busy && !ai ? (
          <div className="mt-3">
            <Thinking lines={["Смотрю обложки твоих роликов…", "Слушаю, что ты говоришь в видео…", "Сравниваю лучшие и слабые…", "Вывожу твою формулу…"]} />
          </div>
        ) : null}

        <p className="mt-3 text-[15px] leading-relaxed text-white/85">{ai ? deep!.whatYouFilm : dna.summary}</p>
        {ai && deep!.style ? <p className="mt-2 text-sm text-white/60">{deep!.style}</p> : null}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {dna.topics.map((t) => (
            <Chip key={t.label} tone="violet">
              {t.label} · {t.count}
            </Chip>
          ))}
          {dna.formats.map((f) => (
            <Chip key={f.key} tone="cyan">
              {f.key === "talk" ? <Mic className="size-3" /> : f.key === "trend-sound" ? <Music2 className="size-3" /> : <Video className="size-3" />} {f.label} · {f.count}
            </Chip>
          ))}
        </div>

        {(ai ? deep!.formula : dna.formula) && (
          <div className="mt-4 rounded-2xl border border-lime/20 bg-lime/[0.05] p-3 text-sm">
            <span className="font-semibold text-lime">Твоя формула: </span>
            <span className="text-white/85">{ai ? deep!.formula : dna.formula}</span>
          </div>
        )}

        {!compact && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-lime">
                <CheckCircle2 className="size-4" /> Делай больше
              </div>
              <ul className="space-y-1.5 text-sm text-white/75">
                {(ai && deep!.more.length ? deep!.more : dna.doMore).map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-pink">
                <Ban className="size-4" /> Перестань
              </div>
              <ul className="space-y-1.5 text-sm text-white/75">
                {(ai && deep!.stop.length ? deep!.stop : dna.stopDoing.length ? dna.stopDoing : ["Пока ничего критичного — держи темп и публикуй регулярно."]).map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {dna.quality !== undefined && (
          <div className="mt-4 max-w-sm">
            <div className="mb-1 flex justify-between text-xs text-white/55">
              <span>Качество картинки (оценка TikTok)</span>
              <span className="font-semibold text-white">{dna.quality}/100</span>
            </div>
            <Progress value={dna.quality} tone={dna.quality >= 55 ? "cyan" : "pink"} className="h-1.5" />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {compact && (
            <Button size="sm" variant="soft" onClick={() => go("analysis")} icon={<ArrowRight className="size-4" />}>
              Разбор каждого ролика
            </Button>
          )}
          {status?.ai && (
            <Button size="sm" variant="ghost" onClick={() => runDeep()} loading={busy} icon={<Sparkles className="size-4" />}>
              {ai ? "Пересмотреть ролики заново" : "ИИ: посмотреть мои ролики"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Разбор каждого ролика (вкладка «Анализ»). */
export function VideoBreakdowns() {
  const { state, dna } = useStore();
  useAutoDeep();
  if (!dna || !state.account?.videos.length) return null;
  const byId = new Map(state.account.videos.map((v) => [v.id, v]));
  const deepById = new Map((state.deep?.source === "ai" ? state.deep.videos : []).map((d) => [d.id, d]));

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
        <Video className="size-5 text-pink" /> Разбор каждого ролика
      </div>
      <p className="mb-4 text-xs text-white/50">Что в ролике, почему такой результат и что конкретно исправить в следующем.</p>
      <div className="space-y-3">
        {dna.videos.map((b, i) => {
          const v = byId.get(b.id);
          if (!v) return null;
          const d = deepById.get(b.id);
          const caption = v.title.replace(/#[\p{L}\p{N}_]+/gu, "").trim();
          return (
            <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3 sm:p-4">
              <div className="flex gap-3 sm:gap-4">
                <Cover v={v} className="h-32 w-24 shrink-0 sm:h-40 sm:w-28" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone={RANK[b.rank].tone}>{RANK[b.rank].t}</Chip>
                    <Chip tone="cyan">{b.formatLabel}</Chip>
                    {(v.labels ?? []).slice(0, 2).map((l) => (
                      <Chip key={l} tone="violet">
                        {labelRu(l)}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm font-semibold">{caption || "Без подписи"}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/55">
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" /> {formatNum(v.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="size-3" /> {formatNum(v.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="size-3" /> {formatNum(v.comments)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="size-3" /> {formatNum(v.shares)}
                    </span>
                    {v.duration > 0 && <span>{v.duration} с</span>}
                    {v.createTime > 0 && <span>{new Date(v.createTime * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>}
                  </div>
                  <p className="mt-2 text-sm text-white/75">{b.verdict}</p>
                  {v.shareUrl && (
                    <a href={v.shareUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-white/40 hover:text-white">
                      <ExternalLink className="size-3" /> Открыть в TikTok
                    </a>
                  )}
                </div>
              </div>

              {d && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-gradient-to-br from-violet/10 to-transparent p-3 text-sm">
                  <div>
                    <span className="font-semibold text-[#b69cff]">Что в ролике: </span>
                    <span className="text-white/80">{d.inside}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#b69cff]">Хук: </span>
                    <span className="text-white/80">{d.hook}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#b69cff]">Почему такой результат: </span>
                    <span className="text-white/80">{d.whyResult}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-lime">Исправь: </span>
                    <span className="text-white/85">{d.fix}</span>
                  </div>
                </div>
              )}

              {v.transcript && !d && (
                <div className="mt-3 rounded-xl bg-white/[0.03] p-3 text-xs text-white/60">
                  <span className="font-semibold text-white/80">Что ты говоришь: </span>«{v.transcript.slice(0, 220)}
                  {v.transcript.length > 220 ? "…" : ""}»
                </div>
              )}

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ul className="space-y-1 text-xs">
                  {b.signals.map((s, k) => (
                    <li key={k} className={cn("flex items-start gap-1.5", s.ok ? "text-white/65" : "text-white/85")}>
                      {s.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-lime" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-pink" />}
                      {s.text}
                    </li>
                  ))}
                </ul>
                {b.fixes.length > 0 && (
                  <div className="rounded-xl bg-white/[0.03] p-3">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-amber">В следующем ролике</div>
                    <ol className="space-y-1.5 text-xs text-white/80">
                      {b.fixes.map((f, k) => (
                        <li key={k} className="flex gap-2">
                          <span className="font-bold text-amber">{k + 1}.</span>
                          {f}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
