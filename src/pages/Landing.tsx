import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Zap,
  Radar,
  Map,
  TrendingUp,
  Loader2,
  CheckCircle2,
  UserCheck,
  Wand2,
} from "lucide-react";
import { NICHES, Niche } from "@/lib/niches";
import { useAppStore } from "@/store/useAppStore";
import AnimatedBackground from "@/components/layout/AnimatedBackground";
import RealDataForm from "@/components/RealDataForm";
import { RealProfileInput } from "@/lib/realAnalysis";

const ANALYSIS_STEPS_DEMO = [
  "Подключаемся к профилю...",
  "Сканируем последние видео...",
  "Анализируем вовлечённость и удержание...",
  "Считаем сильные и слабые стороны...",
  "Собираем персональный план роста...",
];

const ANALYSIS_STEPS_REAL = [
  "Обрабатываем твои реальные цифры...",
  "Считаем вовлечённость по видео...",
  "Вычисляем лучшее время публикаций...",
  "Сравниваем сильные и слабые стороны...",
  "Собираем персональный план роста...",
];

const FEATURES = [
  { icon: Zap, title: "Анализ реальных данных", text: "Считаем метрики по твоим настоящим видео, не наугад" },
  { icon: Radar, title: "Радар трендов", text: "Актуальные форматы и тренды под твою нишу" },
  { icon: TrendingUp, title: "Идеи для видео", text: "Готовые концепции: хук, план, съёмка, подпись" },
  { icon: Map, title: "План к популярности", text: "Пошаговый roadmap на 90 дней с чек-листами" },
];

type Stage = "form" | "mode" | "realForm" | "analyzing" | "done";

export default function Landing() {
  const navigate = useNavigate();
  const connect = useAppStore((s) => s.connect);
  const connectReal = useAppStore((s) => s.connectReal);
  const [username, setUsername] = useState("");
  const [niche, setNiche] = useState<Niche | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"real" | "demo">("real");

  const canSubmit = username.trim().length >= 2 && niche;

  function goToMode(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setError("Укажи юзернейм и выбери нишу контента");
      return;
    }
    setError(null);
    setStage("mode");
  }

  function runAnalyzingSequence(steps: string[], onDone: () => void) {
    setStage("analyzing");
    setStepIndex(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= steps.length) {
        clearInterval(interval);
        setStage("done");
        setTimeout(onDone, 700);
        return;
      }
      setStepIndex(i);
    }, 550);
  }

  function startDemo() {
    runAnalyzingSequence(ANALYSIS_STEPS_DEMO, () => {
      connect(username, niche as Niche);
      navigate("/dashboard");
    });
  }

  function handleRealSubmit(input: RealProfileInput) {
    runAnalyzingSequence(ANALYSIS_STEPS_REAL, () => {
      connectReal(input);
      navigate("/dashboard");
    });
  }

  const analyzingSteps = mode === "real" ? ANALYSIS_STEPS_REAL : ANALYSIS_STEPS_DEMO;
  const isWideStage = stage === "realForm";

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      <div className={`mx-auto px-6 py-10 lg:py-16 ${isWideStage ? "max-w-3xl" : "max-w-6xl"}`}>
        <div className="flex items-center gap-2 mb-16">
          <div className="h-9 w-9 rounded-xl bg-tiktok-gradient flex items-center justify-center shadow-glow">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight">ViralCoach</span>
        </div>

        <div className={isWideStage ? "" : "grid lg:grid-cols-2 gap-14 items-center"}>
          {!isWideStage && (
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-semibold text-cyan-glow mb-6">
                <Sparkles size={13} /> ИИ-наставник по росту в TikTok
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-5">
                Стань популярным в <span className="text-gradient">TikTok</span> в разы быстрее
              </h1>
              <p className="text-ink-secondary text-lg mb-8 max-w-lg">
                Введи свои реальные цифры — умный помощник разберёт твой
                контент по-настоящему, найдёт точки роста, покажет актуальные
                тренды и составит личный план к популярности.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-10">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    className="glass rounded-xl p-3.5 flex items-start gap-3"
                  >
                    <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-cyan-glow">
                      <f.icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{f.title}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{f.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, x: isWideStage ? 0 : 24, y: isWideStage ? 16 : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.6, delay: isWideStage ? 0 : 0.1 }}
            className="glass rounded-3xl p-6 sm:p-8 shadow-card relative"
          >
            <AnimatePresence mode="wait">
              {stage === "form" && (
                <motion.form
                  key="form"
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={goToMode}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="font-bold text-xl mb-1">Подключи свой TikTok</h2>
                    <p className="text-sm text-ink-muted">
                      Введи юзернейм и нишу — начнём персональный анализ
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink-secondary mb-1.5 block">
                      Юзернейм TikTok
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted font-semibold">
                        @
                      </span>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="tvoy_nikneym"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm outline-none focus:border-cyan-glow/60 focus:bg-white/[0.07] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink-secondary mb-1.5 block">
                      Ниша твоего контента
                    </label>
                    <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                      {NICHES.map((n) => (
                        <button
                          type="button"
                          key={n.id}
                          onClick={() => setNiche(n.id)}
                          className={`rounded-xl px-2 py-2.5 text-xs font-medium border transition-all flex flex-col items-center gap-1 ${
                            niche === n.id
                              ? "border-cyan-glow/60 bg-cyan-glow/10 text-white"
                              : "border-white/10 bg-white/[0.03] text-ink-secondary hover:bg-white/[0.06]"
                          }`}
                        >
                          <span className="text-base">{n.emoji}</span>
                          {n.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p className="text-xs text-critical">{error}</p>}

                  <button
                    type="submit"
                    className="w-full bg-tiktok-gradient rounded-xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 shadow-glow-pink hover:opacity-90 active:scale-[0.99] transition-all"
                  >
                    Продолжить <ArrowRight size={16} />
                  </button>
                </motion.form>
              )}

              {stage === "mode" && (
                <motion.div key="mode" exit={{ opacity: 0, y: -10 }} className="space-y-5">
                  <button
                    onClick={() => setStage("form")}
                    className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-white transition-colors"
                  >
                    <ArrowLeft size={13} /> Назад
                  </button>
                  <div>
                    <h2 className="font-bold text-xl mb-1">Как анализируем?</h2>
                    <p className="text-sm text-ink-muted">
                      Для @{username.replace(/^@/, "")} — выбери режим
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("real");
                      setStage("realForm");
                    }}
                    className="w-full text-left rounded-2xl border border-cyan-glow/40 bg-cyan-glow/[0.06] p-4 flex gap-3.5 hover:bg-cyan-glow/[0.1] transition-colors"
                  >
                    <div className="h-10 w-10 rounded-xl bg-cyan-glow/15 flex items-center justify-center shrink-0 text-cyan-glow">
                      <UserCheck size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-2">
                        Мои реальные данные
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-good/20 text-good">
                          РЕКОМЕНДУЕТСЯ
                        </span>
                      </p>
                      <p className="text-xs text-ink-secondary mt-1">
                        Введи подписчиков и статистику последних видео из TikTok
                        Studio — получишь честный анализ именно твоего аккаунта,
                        без единой случайной цифры.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("demo");
                      startDemo();
                    }}
                    className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex gap-3.5 hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 text-ink-muted">
                      <Wand2 size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Быстрое демо</p>
                      <p className="text-xs text-ink-secondary mt-1">
                        Посмотреть на примере со сгенерированными данными —
                        без ввода цифр. Не отражает твой настоящий аккаунт.
                      </p>
                    </div>
                  </button>
                </motion.div>
              )}

              {stage === "realForm" && (
                <motion.div key="realForm" exit={{ opacity: 0, y: -10 }}>
                  <button
                    onClick={() => setStage("mode")}
                    className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-white transition-colors mb-4"
                  >
                    <ArrowLeft size={13} /> Назад
                  </button>
                  <div className="mb-5">
                    <h2 className="font-bold text-xl mb-1">Твои реальные цифры</h2>
                    <p className="text-sm text-ink-muted">
                      Чем больше видео добавишь — тем точнее будет анализ и советы
                    </p>
                  </div>
                  <RealDataForm
                    initialUsername={username}
                    initialNiche={niche}
                    onSubmit={handleRealSubmit}
                  />
                </motion.div>
              )}

              {stage === "analyzing" && (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-6"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-12 w-12 rounded-full bg-tiktok-gradient flex items-center justify-center animate-pulse-glow">
                      <Loader2 size={22} className="animate-spin text-white" />
                    </div>
                    <div>
                      <p className="font-bold">Анализируем @{username.replace(/^@/, "")}</p>
                      <p className="text-xs text-ink-muted">Это займёт пару секунд</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {analyzingSteps.map((step, i) => (
                      <div key={step} className="flex items-center gap-3 text-sm">
                        {i < stepIndex ? (
                          <CheckCircle2 size={18} className="text-good shrink-0" />
                        ) : i === stepIndex ? (
                          <Loader2 size={18} className="animate-spin text-cyan-glow shrink-0" />
                        ) : (
                          <div className="h-[18px] w-[18px] rounded-full border border-white/15 shrink-0" />
                        )}
                        <span
                          className={
                            i <= stepIndex ? "text-white" : "text-ink-muted"
                          }
                        >
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {stage === "done" && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-16 flex flex-col items-center text-center gap-3"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="h-16 w-16 rounded-full bg-good/20 flex items-center justify-center"
                  >
                    <CheckCircle2 size={32} className="text-good" />
                  </motion.div>
                  <p className="font-bold text-lg">Анализ готов!</p>
                  <p className="text-sm text-ink-muted">Открываем твой дашборд...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
