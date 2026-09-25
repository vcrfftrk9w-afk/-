"use client";
import { motion } from "framer-motion";
import { BarChart3, Clock, Crown, Hash, PieChart, RefreshCw, ThumbsDown, ThumbsUp, UserRoundPen, Video, Zap, Quote } from "lucide-react";
import { useStore } from "@/lib/store";
import { useActions, useBusy } from "@/lib/actions";
import { er, formatNum } from "@/lib/analytics";
import type { TikTokVideo } from "@/lib/types";
import { Button, Card, Chip, CopyButton, Empty, Progress, SectionHeader, Skeleton, Thinking } from "../ui";
import { DurationChart, Heatmap, SERIES_A, SERIES_B, ViewsChart } from "../charts";
import { useNav } from "../nav";

const IMPACT = { high: { t: "Высокий эффект", tone: "pink" }, medium: { t: "Средний", tone: "amber" }, low: { t: "Низкий", tone: "default" } } as const;

function VideoCard({ v, label, tone }: { v: TikTokVideo; label: string; tone: "lime" | "pink" }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-white/[0.03] p-3">
      {v.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.coverUrl} alt="" className="h-24 w-16 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-xl bg-white/5">
          <Video className="size-5 text-white/30" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Chip tone={tone}>{label}</Chip>
        <div className="mt-1.5 line-clamp-2 text-sm">{v.title || "Без подписи"}</div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
          <span>👁 {formatNum(v.views)}</span>
          <span>❤️ {formatNum(v.likes)}</span>
          <span>💬 {formatNum(v.comments)}</span>
          <span>↗ {formatNum(v.shares)}</span>
          <span>ER {er(v).toFixed(1)}%</span>
          <span>{v.duration}с</span>
        </div>
      </div>
    </div>
  );
}

export function Analysis() {
  const { state, report } = useStore();
  const { runAnalysis } = useActions();
  const busy = useBusy("analysis");
  const { go } = useNav();
  const a = state.analysis;
  const hasVideos = (state.account?.videos.length ?? 0) > 0;

  return (
    <div>
      <SectionHeader
        icon={<BarChart3 className="size-7 text-cyan" />}
        title="Анализ аккаунта"
        subtitle="Что работает, что тормозит рост и что делать в первую очередь — на основе твоих реальных данных."
        action={
          <Button onClick={() => runAnalysis()} loading={busy} icon={<RefreshCw className="size-4" />}>
            {a ? "Обновить AI-анализ" : "Запустить AI-анализ"}
          </Button>
        }
      />

      {busy && !a && (
        <Card className="mb-5">
          <Thinking lines={["Читаю подписи и хэштеги…", "Сравниваю лучшие и худшие ролики…", "Ищу паттерны времени и длины…", "Пишу стратегию…"]} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </Card>
      )}

      {a && (
        <div className="space-y-5">
          <Card glow>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={a.source === "ai" ? "lime" : "default"}>{a.source === "ai" ? "AI-аудит" : "Офлайн-аудит"}</Chip>
              <Chip tone="cyan">Прогноз через 30 дней: {formatNum(a.predictedFollowers30d)} подписчиков</Chip>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-white/85">{a.summary}</p>
            <p className="mt-3 rounded-2xl border-l-2 border-pink bg-pink/5 p-3 text-sm leading-relaxed text-white/75">{a.diagnosis}</p>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2 font-display font-bold">
              <Zap className="size-5 text-amber" /> Приоритеты: делай в этом порядке
            </div>
            <div className="space-y-3">
              {a.priorities.map((p, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex gap-4 rounded-2xl bg-white/[0.03] p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink to-violet font-display font-bold">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.title}</span>
                      <Chip tone={IMPACT[p.impact]?.tone ?? "default"}>{IMPACT[p.impact]?.t ?? p.impact}</Chip>
                    </div>
                    <div className="mt-1 text-sm text-white/55">{p.why}</div>
                    <div className="mt-2 text-sm text-white/85">→ {p.how}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center gap-2 font-display font-bold">
                <ThumbsUp className="size-5 text-lime" /> Сильные стороны
              </div>
              <ul className="space-y-2 text-sm text-white/75">
                {a.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-lime">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <div className="mb-3 flex items-center gap-2 font-display font-bold">
                <ThumbsDown className="size-5 text-pink" /> Точки роста
              </div>
              <ul className="space-y-2 text-sm text-white/75">
                {a.weaknesses.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-pink">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center gap-2 font-display font-bold">
                <PieChart className="size-5 text-violet" /> Контент-рубрики
              </div>
              <div className="space-y-3">
                {a.contentPillars.map((p, i) => (
                  <div key={i}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-white/60">{p.share}%</span>
                    </div>
                    <Progress value={p.share} tone={i % 2 ? "pink" : "cyan"} className="h-1.5" />
                    <div className="mt-1 text-xs text-white/50">{p.description}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="mb-4 flex items-center gap-2 font-display font-bold">
                <UserRoundPen className="size-5 text-cyan" /> Упаковка профиля
              </div>
              <div className="space-y-3">
                {a.profileFixes.map((f, i) => (
                  <div key={i} className="rounded-2xl bg-white/[0.03] p-3">
                    <div className="text-xs uppercase tracking-wider text-white/40">{f.field}</div>
                    <div className="mt-1 text-xs text-white/40 line-through">{f.current}</div>
                    <div className="mt-1 flex items-start justify-between gap-2 text-sm text-white/90">
                      <span>{f.suggestion}</span>
                      <CopyButton text={f.suggestion} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <div className="mb-4 flex items-center gap-2 font-display font-bold">
              <Quote className="size-5 text-pink" /> Хуки, которые стоит попробовать
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {a.hookAdvice.map((h, i) => (
                <div key={i} className="flex items-start justify-between gap-2 rounded-2xl bg-white/[0.03] p-3 text-sm text-white/80">
                  <span>{h}</span>
                  <CopyButton text={h} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Метрики */}
      <h2 className="mb-4 mt-10 font-display text-xl font-bold">Метрики</h2>
      {!hasVideos ? (
        <Empty
          icon={<Video className="size-7" />}
          title="Нет данных по видео"
          text="Войди через TikTok, чтобы загрузить все ролики со статистикой, или добавь несколько видео вручную во вкладке «Профиль»."
          action={<Button onClick={() => go("settings")}>Добавить видео</Button>}
        />
      ) : (
        report && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Средние просмотры", formatNum(report.avgViews)],
                ["Лайки / просмотры", `${report.likeRate.toFixed(2)}%`],
                ["Комменты / просмотры", `${report.commentRate.toFixed(2)}%`],
                ["Репосты / просмотры", `${report.shareRate.toFixed(2)}%`],
              ].map(([l, v], i) => (
                <Card key={l} delay={i * 0.04} className="p-4">
                  <div className="text-xs text-white/50">{l}</div>
                  <div className="mt-1 font-display text-xl font-bold">{v}</div>
                </Card>
              ))}
            </div>

            <Card>
              <div className="mb-1 font-display font-bold">Просмотры по видео</div>
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-white/50">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: SERIES_A }} /> обычный ролик
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: SERIES_B }} /> залетел (&gt;3× медианы)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 border-t border-dashed border-white/50" /> медиана {formatNum(report.medianViews)}
                </span>
              </div>
              <ViewsChart data={report.timeline} median={report.medianViews} />
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <div className="mb-1 flex items-center gap-2 font-display font-bold">
                  <Clock className="size-5 text-cyan" /> Длина ролика → просмотры
                </div>
                <p className="mb-3 text-xs text-white/45">Розовым — лучшая длина для тебя</p>
                {report.durationBuckets.some((b) => b.count > 0) ? (
                  <DurationChart data={report.durationBuckets.filter((b) => b.count > 0)} />
                ) : (
                  <p className="text-sm text-white/50">Длительность роликов неизвестна. Добавь скрин или файл «Контент» из TikTok Studio.</p>
                )}
              </Card>
              <Card>
                <div className="mb-3 flex items-center gap-2 font-display font-bold">
                  <Hash className="size-5 text-pink" /> Хэштеги по эффективности
                </div>
                <div className="space-y-2">
                  {report.topHashtags.slice(0, 8).map((t, i) => (
                    <div key={t.tag} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-right text-xs text-white/40">{i + 1}</span>
                      <span className="flex-1 truncate font-semibold">{t.tag}</span>
                      <span className="text-xs text-white/45">{t.uses}×</span>
                      <span className="w-16 text-right font-display text-sm">{formatNum(t.avgViews)}</span>
                    </div>
                  ))}
                  {!report.topHashtags.length && <p className="text-sm text-white/50">В подписях нет хэштегов.</p>}
                </div>
              </Card>
            </div>

            <Card>
              <div className="mb-1 font-display font-bold">Когда твои ролики заходят лучше</div>
              <p className="mb-4 text-xs text-white/45">
                {report.slotsFromData ? "Лучшие окна по твоим роликам: " : "Мало роликов с датами — пока общие рекомендации: "}
                <span className="text-white/80">{report.bestSlots.map((s) => s.label).join(" · ")}</span>
              </p>
              {report.heatmap.length > 0 && <Heatmap cells={report.heatmap} />}
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              {report.bestVideo && (
                <Card>
                  <div className="mb-3 flex items-center gap-2 font-display font-bold">
                    <Crown className="size-5 text-amber" /> Лучший ролик — повтори формулу
                  </div>
                  <VideoCard v={report.bestVideo} label="Топ" tone="lime" />
                </Card>
              )}
              {report.worstVideo && report.worstVideo !== report.bestVideo && (
                <Card>
                  <div className="mb-3 flex items-center gap-2 font-display font-bold">
                    <ThumbsDown className="size-5 text-pink" /> Слабый ролик — разбери ошибки
                  </div>
                  <VideoCard v={report.worstVideo} label="Анти-топ" tone="pink" />
                </Card>
              )}
            </div>

            <Card>
              <div className="mb-3 font-display font-bold">Подробные оценки</div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {report.subScores.map((s) => (
                  <div key={s.key} className="rounded-2xl bg-white/[0.03] p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold">{s.label}</span>
                      <span className="font-display text-2xl font-bold">{s.score}</span>
                    </div>
                    <Progress value={s.score} className="mt-2 h-1.5" />
                    <div className="mt-2 text-xs text-white/50">{s.hint}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )
      )}
    </div>
  );
}
