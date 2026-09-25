"use client";
import { motion } from "framer-motion";
import { ArrowRight, Upload, Bot, CheckCircle2, Circle, Eye, Flame, Heart, Lightbulb, RefreshCw, Sparkles, Target, TrendingUp, Trophy, Users, Zap, AlertTriangle, Info } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useStore, xpLevel } from "@/lib/store";
import { planDayIndex, useActions, useBusy, useToggleTask } from "@/lib/actions";
import { forecastGrowth, formatNum } from "@/lib/analytics";
import { getNiche } from "@/lib/knowledge";
import { AnimatedNumber, Button, Card, Chip, Progress, ScoreRing, Thinking, cn } from "../ui";
import { ForecastChart } from "../charts";
import { useNav } from "../nav";
import { MissionCard } from "../mission-card";
import { ContentSummary } from "../content-dna";

export function Overview() {
  const { state, report, status } = useStore();
  const { runAnalysis, fetchTrends, makePlan } = useActions();
  const toggle = useToggleTask();
  const { go } = useNav();
  const analyzing = useBusy("analysis");
  const planning = useBusy("plan");
  const acc = state.account!;
  const settings = state.settings!;
  const niche = getNiche(settings.niche);
  const lv = xpLevel(state.xp);
  const started = useRef(false);

  // Автозапуск: при первом входе — анализ и тренды
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!state.analysis) runAnalysis();
    if (!state.trends) fetchTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forecast = useMemo(() => (report ? forecastGrowth(acc, report, settings, Math.min(Math.max(settings.goalDays, 30), 180)) : []), [acc, report, settings]);
  const hist = acc.history;
  const delta = hist.length > 1 ? acc.profile.followers - hist[0].followers : 0;

  const today = state.plan ? state.plan.days[planDayIndex(state.plan)] : null;
  const insights = report?.insights.slice(0, 4) ?? [];
  const hour = new Date().getHours();
  const greet = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  const stats = [
    { label: "Подписчики", value: acc.profile.followers, icon: Users, sub: delta ? `${delta > 0 ? "+" : ""}${formatNum(delta)} с подключения` : `цель ${formatNum(settings.goalFollowers)}` },
    { label: "Лайки", value: acc.profile.likes, icon: Heart, sub: `${acc.profile.videoCount} видео` },
    { label: "Медиана просмотров", value: report?.medianViews ?? 0, icon: Eye, sub: report ? `${(report.viewsPerFollower * 100).toFixed(0)}% от подписчиков` : "" },
    { label: "Вовлечённость", value: report?.engagementRate ?? 0, icon: Zap, sub: `норма ниши ≈ ${niche.benchmarkER}%`, pct: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-white/50">
            {greet}, {acc.profile.displayName || acc.profile.username} 👋
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Твой путь к <span className="text-gradient">{formatNum(settings.goalFollowers)}</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="violet">
            {niche.emoji} {niche.label}
          </Chip>
          <Chip tone={acc.source === "demo" ? "amber" : "cyan"}>{{ oauth: "TikTok подключён", public: "Публичные данные", demo: "Демо: цифры-пример", manual: "Ручной ввод", import: "Твои данные" }[acc.source]}</Chip>
          <Chip tone={status?.ai ? "lime" : "default"}>{status?.ai ? "AI онлайн" : "Офлайн-движок"}</Chip>
        </div>
      </div>

      {acc.source === "demo" && (
        <Card className="flex flex-col gap-3 border-amber/30 bg-amber/[0.06] sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-white/80">
            <span className="font-semibold text-amber">Это пример с выдуманными цифрами.</span> Загрузи скриншоты своего TikTok или файл из TikTok Studio — и всё пересчитается под тебя.
          </div>
          <Button size="sm" onClick={() => go("settings")} icon={<Upload className="size-4" />}>
            Загрузить мои данные
          </Button>
        </Card>
      )}
      {acc.source !== "demo" && acc.videos.length === 0 && (
        <Card className="flex flex-col gap-3 border-cyan/25 bg-cyan/[0.05] sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-white/80">
            <span className="font-semibold text-cyan">Нет данных по роликам.</span> Добавь скрин профиля с сеткой видео или раздел «Контент» из TikTok Studio — анализ станет точным.
          </div>
          <Button size="sm" onClick={() => go("settings")} icon={<Upload className="size-4" />}>
            Добавить ролики
          </Button>
        </Card>
      )}

      <MissionCard />

      <ContentSummary compact />

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Score */}
        <Card glow className="flex flex-col items-center">
          <ScoreRing score={report?.viralScore ?? 0} size={200} />
          <div className="mt-3 flex items-center gap-2">
            <Trophy className="size-4 text-amber" />
            <span className="font-display font-bold">{report?.level}</span>
          </div>
          <div className="mt-5 w-full space-y-2.5">
            {report?.subScores.map((s, i) => (
              <div key={s.key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-white/60">{s.label}</span>
                  <span className="font-semibold">{s.score}</span>
                </div>
                <Progress value={s.score} tone={s.score >= 60 ? "cyan" : s.score >= 35 ? "grad" : "pink"} className="h-1.5" />
                <span className="sr-only">{i}</span>
              </div>
            ))}
          </div>
          <Button variant="soft" size="sm" className="mt-5 w-full" onClick={() => go("analysis")} icon={<ArrowRight className="size-4" />}>
            Подробный разбор
          </Button>
        </Card>

        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {stats.map((s, i) => (
              <Card key={s.label} delay={i * 0.05} className="p-4">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <s.icon className="size-3.5" /> {s.label}
                </div>
                <div className="mt-2 font-display text-2xl font-bold">
                  <AnimatedNumber value={s.value} format={(n) => (s.pct ? `${n.toFixed(1)}%` : formatNum(n))} />
                </div>
                <div className="mt-1 truncate text-[11px] text-white/40">{s.sub}</div>
              </Card>
            ))}
          </div>

          {/* AI verdict */}
          <Card className="relative overflow-hidden">
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-pink/20 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink to-violet">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/45">
                  Вердикт ViralPilot {state.analysis?.source === "ai" && <Chip tone="lime">AI</Chip>}
                </div>
                {analyzing && !state.analysis ? (
                  <Thinking lines={["Изучаю твои видео…", "Считаю вовлечённость…", "Ищу, что уже залетало…", "Формирую стратегию…"]} />
                ) : state.analysis ? (
                  <>
                    <p className="text-[15px] leading-relaxed text-white/85">{state.analysis.summary}</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{state.analysis.diagnosis}</p>
                  </>
                ) : (
                  <Button size="sm" onClick={() => runAnalysis()}>
                    Запустить анализ
                  </Button>
                )}
              </div>
              <button onClick={() => runAnalysis()} disabled={analyzing} className="rounded-xl p-2 text-white/40 transition hover:bg-white/10 hover:text-white disabled:animate-spin" title="Обновить анализ">
                <RefreshCw className="size-4" />
              </button>
            </div>
          </Card>

          {/* Today */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-display font-bold">
                <Target className="size-5 text-pink" /> Задачи на сегодня
              </div>
              {today && <Chip>День {today.day} / 30</Chip>}
            </div>
            {today ? (
              <div className="space-y-2">
                {today.tasks.map((t) => (
                  <motion.button
                    key={t.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggle(today.day, t.id)}
                    className={cn("flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition", t.done ? "border-cyan/30 bg-cyan/5" : "border-white/8 bg-white/[0.02] hover:border-white/20")}
                  >
                    {t.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-cyan" /> : <Circle className="mt-0.5 size-5 shrink-0 text-white/30" />}
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm font-semibold", t.done && "text-white/50 line-through")}>{t.title}</div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-white/50">{t.detail}</div>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-lime">+{t.xp}</span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-white/55">Создай персональный план на 30 дней — каждый день я буду говорить, что снимать и делать.</p>
                <Button onClick={() => makePlan()} loading={planning} icon={<Target className="size-4" />}>
                  Создать план
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-1 flex items-center gap-2 font-display font-bold">
            <TrendingUp className="size-5 text-cyan" /> Прогноз роста подписчиков
          </div>
          <p className="mb-4 text-xs text-white/45">Модель на основе твоих метрик. Выполняя план, ты попадаешь на верхнюю кривую.</p>
          {forecast.length > 0 && <ForecastChart data={forecast} goal={settings.goalFollowers} />}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2 font-display font-bold">
            <Zap className="size-5 text-amber" /> Главное сейчас
          </div>
          <div className="space-y-3">
            {insights.map((ins, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }} className="flex gap-3">
                {ins.type === "win" ? <Trophy className="mt-0.5 size-4 shrink-0 text-lime" /> : ins.type === "warn" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" /> : <Info className="mt-0.5 size-4 shrink-0 text-cyan" />}
                <div>
                  <div className="text-sm font-semibold">{ins.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-white/55">{ins.text}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Flame, title: "Горячие тренды", text: state.trends ? `${state.trends.trends.length} трендов под твою нишу` : "Ищу тренды…", tab: "trends" as const, grad: "from-pink/25 to-orange-500/10" },
          { icon: Lightbulb, title: "Что снять дальше", text: state.ideas.length ? `${state.ideas.length} идей ждут тебя` : "Сгенерировать идеи", tab: "ideas" as const, grad: "from-amber/20 to-lime/5" },
          { icon: Bot, title: "Спросить коуча", text: "Любой вопрос о росте", tab: "coach" as const, grad: "from-cyan/20 to-violet/10" },
        ].map((q, i) => (
          <motion.button
            key={q.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileHover={{ y: -3 }}
            onClick={() => go(q.tab)}
            className={cn("glass group flex items-center gap-4 rounded-3xl bg-gradient-to-br p-5 text-left", q.grad)}
          >
            <q.icon className="size-7" />
            <div className="flex-1">
              <div className="font-display font-bold">{q.title}</div>
              <div className="text-xs text-white/55">{q.text}</div>
            </div>
            <ArrowRight className="size-5 text-white/40 transition group-hover:translate-x-1 group-hover:text-white" />
          </motion.button>
        ))}
      </div>

      <Card className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-lime/30 to-cyan/20 font-display text-xl font-bold">{lv.level}</div>
          <div>
            <div className="font-display font-bold">Уровень автора {lv.level}</div>
            <div className="text-xs text-white/50">
              {lv.into} / {lv.need} XP до следующего уровня · серия {state.streak.count} дн. 🔥
            </div>
          </div>
        </div>
        <Progress value={lv.progress * 100} className="h-2.5 sm:max-w-sm" />
      </Card>
    </div>
  );
}
