"use client";
import { motion } from "framer-motion";
import { BarChart3, Bot, Flame, Heart, Lightbulb, MessageCircle, Rocket, Share2, Target, TrendingUp, Clapperboard, Zap } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aurora, Button, Logo, AnimatedNumber } from "@/components/ui";
import { Onboarding } from "@/components/onboarding";
import { ScanAccount } from "@/components/scan-account";
import { useStore } from "@/lib/store";
import { getJSON } from "@/lib/api";
import { toast } from "@/components/toast";
import type { Account, TikTokProfile, TikTokVideo } from "@/lib/types";

const FEATURES = [
  { icon: BarChart3, title: "Глубокий анализ", text: "Viral Score, вовлечённость, лучшее время, длина роликов, хэштеги — всё по твоим реальным данным.", color: "text-cyan" },
  { icon: Flame, title: "Тренды из интернета", text: "AI ищет свежие звуки, форматы и челленджи под твою нишу и объясняет, как их снять.", color: "text-pink" },
  { icon: Lightbulb, title: "Идеи для следующих видео", text: "Персональные идеи с хуком, концептом и прогнозом вирусности.", color: "text-amber" },
  { icon: Clapperboard, title: "Готовый сценарий", text: "Посекундная раскадровка, текст на экране, свет, монтаж, подпись и хэштеги.", color: "text-violet" },
  { icon: Target, title: "План на 30 дней", text: "Каждый день — конкретные задачи. XP, уровни и серия дней держат в тонусе.", color: "text-lime" },
  { icon: Bot, title: "AI-коуч 24/7", text: "Спроси что угодно: почему мало просмотров, как снять тренд, что выложить сегодня.", color: "text-cyan" },
];

function PhoneMock() {
  return (
    <motion.div initial={{ opacity: 0, y: 40, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: -4 }} transition={{ duration: 0.9, delay: 0.2 }} className="relative mx-auto w-[270px] animate-float">
      <div className="absolute -inset-10 rounded-full bg-gradient-to-br from-cyan/30 via-violet/20 to-pink/30 blur-3xl" />
      <div className="relative h-[540px] overflow-hidden rounded-[44px] border-[6px] border-white/10 bg-gradient-to-b from-[#1a1030] via-[#120c1f] to-[#0a0a12] shadow-2xl">
        <div className="absolute left-1/2 top-3 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(254,44,85,.35),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(37,244,238,.25),transparent_50%)]" />
        <div className="absolute right-3 top-1/3 flex flex-col items-center gap-5 text-white">
          {[
            { I: Heart, v: 482000, fill: true },
            { I: MessageCircle, v: 12400 },
            { I: Share2, v: 38100 },
          ].map(({ I, v, fill }, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <I className={fill ? "size-8 fill-pink text-pink" : "size-8"} />
              <span className="text-[11px] font-bold">
                <AnimatedNumber value={v} format={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${Math.round(n)}`)} />
              </span>
            </div>
          ))}
        </div>
        <div className="absolute bottom-6 left-4 right-16 space-y-2">
          <div className="text-sm font-bold">@you</div>
          <div className="text-xs text-white/80">POV: ты нашёл тренд раньше всех 🔥 #fyp #тренд</div>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2 }}
          className="glass-strong absolute left-3 top-16 rounded-2xl px-3 py-2 text-xs"
        >
          <div className="flex items-center gap-1.5 font-semibold text-cyan">
            <TrendingUp className="size-3.5" /> +2 340 подписчиков
          </div>
          <div className="text-white/50">за 24 часа</div>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.6, type: "spring" }}
        className="glass-strong absolute -left-24 bottom-24 hidden w-48 rounded-2xl p-3 text-xs shadow-xl sm:block"
      >
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-pink">
          <Zap className="size-3.5" /> Совет ViralPilot
        </div>
        <div className="text-white/70">Начни с результата — удержание вырастет на 40%</div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2, type: "spring" }}
        className="glass-strong absolute -right-20 top-40 hidden rounded-2xl p-3 text-center sm:block"
      >
        <div className="font-display text-2xl font-bold text-gradient">87</div>
        <div className="text-[10px] uppercase tracking-widest text-white/50">Viral Score</div>
      </motion.div>
    </motion.div>
  );
}

function Landing() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, hydrated, refreshStatus, status } = useStore();
  const [oauthAccount, setOauthAccount] = useState<Account | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const onboardRef = useRef<HTMLDivElement>(null);

  // Возврат после входа через TikTok
  useEffect(() => {
    const err = params.get("error");
    if (err) toast(err === "oauth_not_configured" ? "Вход через TikTok не настроен (см. README)" : `Ошибка входа: ${err}`, "warn");
    if (params.get("connected") === "tiktok") {
      (async () => {
        try {
          const r = await getJSON<{ profile: TikTokProfile; videos: TikTokVideo[] }>("/api/tiktok/me");
          setOauthAccount({ source: "oauth", profile: r.profile, videos: r.videos, connectedAt: Date.now(), history: [{ t: Date.now(), followers: r.profile.followers, likes: r.profile.likes }] });
          setShowOnboarding(true);
          refreshStatus();
          toast(`TikTok подключён: @${r.profile.username}, ${r.videos.length} видео загружено`);
          setTimeout(() => onboardRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
        } catch (e) {
          toast((e as Error).message, "warn");
        }
      })();
    }
  }, [params, refreshStatus]);

  useEffect(() => {
    if (hydrated && state.account && state.settings && !params.get("connected")) router.replace("/dashboard");
  }, [hydrated, state.account, state.settings, router, params]);

  const start = () => {
    setShowOnboarding(true);
    setTimeout(() => onboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <main className="relative">
      <Aurora />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <Button variant="outline" size="sm" onClick={start}>
          Начать бесплатно
        </Button>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-lime" />
            </span>
            AI-продюсер для TikTok · тренды обновляются в реальном времени
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Стань популярным
            <br />в TikTok <span className="text-gradient-anim">в разы быстрее</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 max-w-xl text-lg text-white/60">
            {status && !status.static
              ? "Введи свой ник — ViralPilot просканирует аккаунт и ролики, найдёт, что у тебя залетает, подберёт тренды, придумает следующие видео с готовым сценарием и поведёт по плану к цели."
              : "Подключи аккаунт — ViralPilot разберёт твой контент, найдёт горячие тренды в твоей нише, придумает следующие видео с готовым сценарием и поведёт тебя по плану к цели."}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 max-w-xl">
            {status && !status.static ? (
              <ScanAccount
                full={status.scan === "full"}
                onDone={(r) => {
                  setOauthAccount({ source: "public", profile: r.profile, videos: r.videos, connectedAt: Date.now(), history: [{ t: Date.now(), followers: r.profile.followers, likes: r.profile.likes }] });
                  setShowOnboarding(true);
                  setTimeout(() => onboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
                }}
              />
            ) : (
              <Button size="lg" onClick={start} icon={<Rocket className="size-5" />}>
                Подключить TikTok
              </Button>
            )}
          </motion.div>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
            {[
              ["60 сек", "до первого анализа"],
              ["30 дней", "пошаговый план"],
              ["24/7", "AI-коуч"],
            ].map(([a, b]) => (
              <div key={a}>
                <div className="font-display text-xl font-bold">{a}</div>
                <div className="text-xs text-white/45">{b}</div>
              </div>
            ))}
          </div>
        </div>
        <PhoneMock />
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="mb-10 text-center font-display text-3xl font-bold">
          Всё, что нужно для роста — <span className="text-gradient">в одном месте</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -4 }}
              className="glass rounded-3xl p-6"
            >
              <f.icon className={`mb-4 size-7 ${f.color}`} />
              <div className="font-display font-bold">{f.title}</div>
              <p className="mt-2 text-sm text-white/55">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["1", "Введи свой @ник", "Я сам просканирую профиль и ролики."],
            ["2", "Получи разбор", "Что работает, что мешает расти и что делать прямо сегодня."],
            ["3", "Снимай по плану", "Тренды, идеи и сценарии каждый день — растёшь, отмечаешь задачи и получаешь XP."],
          ].map(([n, t, d]) => (
            <div key={n} className="relative rounded-3xl border border-white/8 p-6">
              <div className="font-display text-5xl font-bold text-white/10">{n}</div>
              <div className="mt-2 font-display font-bold">{t}</div>
              <div className="mt-1 text-sm text-white/55">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section ref={onboardRef} className="mx-auto max-w-6xl scroll-mt-6 px-5 pb-24">
        {showOnboarding || oauthAccount ? (
          <Onboarding key={oauthAccount?.profile.username ?? "new"} initialAccount={oauthAccount} />
        ) : (
          <div className="glass ring-gradient mx-auto flex max-w-2xl flex-col items-center rounded-3xl p-10 text-center">
            <h3 className="font-display text-2xl font-bold">Готов(а) залететь в рекомендации?</h3>
            <p className="mt-2 text-sm text-white/55">Настройка займёт меньше минуты.</p>
            <Button size="lg" className="mt-6" onClick={start} icon={<Rocket className="size-5" />}>
              Начать
            </Button>
          </div>
        )}
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/35">ViralPilot · не аффилирован с TikTok / ByteDance</footer>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Landing />
    </Suspense>
  );
}
