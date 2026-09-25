"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, AtSign, Camera, CameraOff, Check, Loader2, LogIn, PenLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NICHES } from "@/lib/knowledge";
import type { Account, NicheId, TikTokProfile, TikTokVideo, UserSettings } from "@/lib/types";
import { useStore } from "@/lib/store";
import { getJSON } from "@/lib/api";
import { makeDemoAccount } from "@/lib/demo";
import { formatNum } from "@/lib/analytics";
import { Button, Card, cn } from "./ui";
import { toast } from "./toast";

const DEFAULT_SETTINGS: UserSettings = {
  niche: "dance",
  goalFollowers: 10000,
  goalDays: 60,
  postsPerWeek: 7,
  hoursPerWeek: 6,
  experience: "new",
  region: "RU",
  language: "русский",
  faceOnCamera: true,
};

type Step = "connect" | "niche" | "goals" | "about";

export function Onboarding({ initialAccount }: { initialAccount?: Account | null }) {
  const router = useRouter();
  const { update, status } = useStore();
  const [step, setStep] = useState<Step>(initialAccount ? "niche" : "connect");
  const [account, setAccount] = useState<Account | null>(initialAccount ?? null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualData, setManualData] = useState({ followers: "", likes: "", videos: "" });
  const [demo, setDemo] = useState(false);

  const set = <K extends keyof UserSettings>(k: K, v: UserSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const steps: Step[] = ["connect", "niche", "goals", "about"];
  const idx = steps.indexOf(step);

  async function importPublic() {
    if (!username.trim()) return toast("Введи свой @username", "warn");
    setLoading(true);
    try {
      const r = await getJSON<{ profile: TikTokProfile; videos: TikTokVideo[] }>(`/api/tiktok/public?u=${encodeURIComponent(username)}`);
      setAccount({ source: "public", profile: r.profile, videos: r.videos, connectedAt: Date.now(), history: [{ t: Date.now(), followers: r.profile.followers, likes: r.profile.likes }] });
      toast(`Нашёл @${r.profile.username}: ${formatNum(r.profile.followers)} подписчиков`);
      setStep("niche");
    } catch (e) {
      toast(`${(e as Error).message}. Введи цифры вручную — это займёт 10 секунд.`, "warn");
      setManual(true);
    } finally {
      setLoading(false);
    }
  }

  function continueManual() {
    const u = username.trim().replace(/^@/, "") || "me";
    const followers = Number(manualData.followers) || 0;
    const likes = Number(manualData.likes) || 0;
    setAccount({
      source: "manual",
      profile: { username: u, displayName: u, followers, following: 0, likes, videoCount: Number(manualData.videos) || 0, bio: "" },
      videos: [],
      connectedAt: Date.now(),
      history: [{ t: Date.now(), followers, likes }],
    });
    setStep("niche");
  }

  function startDemo() {
    setDemo(true);
    setStep("niche");
  }

  function finish() {
    const acc = demo || !account ? makeDemoAccount(username.trim().replace(/^@/, "") || "demo.creator", settings.niche) : account;
    update(() => ({ settings, account: acc, analysis: null, trends: null, ideas: [], plan: null }));
    toast("Готово! Запускаю анализ 🚀");
    router.push("/dashboard");
  }

  return (
    <Card glow className="mx-auto w-full max-w-2xl p-6 sm:p-8">
      {/* Прогресс шагов */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
            <motion.div className="h-full bg-gradient-to-r from-cyan to-pink" initial={false} animate={{ width: i <= idx ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
          {step === "connect" && (
            <div>
              <h2 className="font-display text-2xl font-bold">Подключи свой TikTok</h2>
              <p className="mt-2 text-sm text-white/55">Я изучу твой аккаунт и видео, чтобы советы были про тебя, а не «в общем».</p>

              <div className="mt-6 space-y-3">
                <a
                  href={status?.tiktokOAuth ? "/api/tiktok/login" : undefined}
                  onClick={(e) => {
                    if (!status?.tiktokOAuth) {
                      e.preventDefault();
                      toast(
                        status?.static
                          ? "Вход через TikTok работает в полной версии приложения со своим сервером. Здесь введи ник и цифры профиля — или открой демо."
                          : "Вход через TikTok ещё не настроен: добавь TIKTOK_CLIENT_KEY и TIKTOK_CLIENT_SECRET в .env (инструкция в README)",
                        "info",
                      );
                    }
                  }}
                  className={cn(
                    "group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/50 hover:bg-white/[0.07]",
                    !status?.tiktokOAuth && "opacity-70",
                  )}
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-black">
                    <svg viewBox="0 0 48 48" className="size-7">
                      <path fill="#25f4ee" d="M20 18.5v-1.9a12 12 0 1 0 8.6 11.5V14.9a15.3 15.3 0 0 0 9 2.9v-5.6a9 9 0 0 1-9-9h-5.4v25a5.4 5.4 0 1 1-3.2-5z" transform="translate(-1 -1)" />
                      <path fill="#fe2c55" d="M20 18.5v-1.9a12 12 0 1 0 8.6 11.5V14.9a15.3 15.3 0 0 0 9 2.9v-5.6a9 9 0 0 1-9-9h-5.4v25a5.4 5.4 0 1 1-3.2-5z" transform="translate(1 1)" />
                      <path fill="#fff" d="M20 18.5v-1.9a12 12 0 1 0 8.6 11.5V14.9a15.3 15.3 0 0 0 9 2.9v-5.6a9 9 0 0 1-9-9h-5.4v25a5.4 5.4 0 1 1-3.2-5z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-semibold">
                      Войти через TikTok <span className="rounded-full bg-cyan/15 px-2 py-0.5 text-[10px] font-bold text-cyan">ТОЧНЕЕ ВСЕГО</span>
                    </div>
                    <div className="text-xs text-white/50">Официальный вход: все видео, просмотры, лайки, комменты и репосты</div>
                  </div>
                  <LogIn className="size-5 text-white/40 transition group-hover:translate-x-1 group-hover:text-white" />
                </a>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <AtSign className="size-4 text-pink" /> Или просто введи свой ник
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">@</span>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && importPublic()}
                        placeholder="username или ссылка на профиль"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-9 pr-4 text-sm outline-none transition focus:border-pink/60"
                      />
                    </div>
                    <Button onClick={importPublic} loading={loading} className="h-12" icon={!loading && <ArrowRight className="size-4" />}>
                      Найти
                    </Button>
                  </div>
                  <AnimatePresence>
                    {manual && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-4 rounded-2xl bg-black/30 p-4">
                          <div className="mb-3 flex items-center gap-2 text-xs text-white/60">
                            <PenLine className="size-3.5" /> Цифры из своего профиля в TikTok:
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {(["followers", "likes", "videos"] as const).map((k) => (
                              <input
                                key={k}
                                inputMode="numeric"
                                value={manualData[k]}
                                onChange={(e) => setManualData((d) => ({ ...d, [k]: e.target.value.replace(/\D/g, "") }))}
                                placeholder={{ followers: "Подписчики", likes: "Лайки", videos: "Видео" }[k]}
                                className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-cyan/60"
                              />
                            ))}
                          </div>
                          <Button variant="soft" size="sm" className="mt-3 w-full" onClick={continueManual}>
                            Продолжить
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button onClick={startDemo} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm text-white/55 transition hover:text-white">
                  <Sparkles className="size-4" /> Посмотреть на демо-аккаунте
                </button>
              </div>
            </div>
          )}

          {step === "niche" && (
            <div>
              {account && (
                <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
                  {account.profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={account.profile.avatarUrl} alt="" className="size-11 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-pink font-bold">{account.profile.username[0]?.toUpperCase()}</div>
                  )}
                  <div className="text-sm">
                    <div className="font-semibold">@{account.profile.username}</div>
                    <div className="text-white/50">
                      {formatNum(account.profile.followers)} подписчиков · {formatNum(account.profile.likes)} лайков
                    </div>
                  </div>
                  <Check className="ml-auto size-5 text-cyan" />
                </div>
              )}
              <h2 className="font-display text-2xl font-bold">Что ты снимаешь?</h2>
              <p className="mt-2 text-sm text-white/55">Под нишу я подберу тренды, форматы и стратегию.</p>
              <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {NICHES.map((n) => (
                  <motion.button
                    key={n.id}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => set("niche", n.id as NicheId)}
                    className={cn(
                      "relative flex items-center gap-2.5 overflow-hidden rounded-2xl border p-3 text-left text-sm font-semibold transition",
                      settings.niche === n.id ? "border-transparent text-white" : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25",
                    )}
                  >
                    {settings.niche === n.id && <motion.div layoutId="nicheSel" className={cn("absolute inset-0 bg-gradient-to-br opacity-90", n.gradient)} />}
                    <span className="relative text-xl">{n.emoji}</span>
                    <span className="relative">{n.label}</span>
                  </motion.button>
                ))}
              </div>
              <input
                value={settings.subNiche ?? ""}
                onChange={(e) => set("subNiche", e.target.value)}
                placeholder="Уточни (необязательно): например, k-pop каверы, макияж для школы…"
                className="mt-4 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none focus:border-pink/60"
              />
            </div>
          )}

          {step === "goals" && (
            <div>
              <h2 className="font-display text-2xl font-bold">Какая цель?</h2>
              <p className="mt-2 text-sm text-white/55">Я построю план и буду следить за прогрессом.</p>
              <div className="mt-6 space-y-6">
                <Slider label="Хочу подписчиков" value={settings.goalFollowers} display={formatNum(settings.goalFollowers)} min={1000} max={1000000} log onChange={(v) => set("goalFollowers", v)} />
                <Slider label="За срок" value={settings.goalDays} display={`${settings.goalDays} дней`} min={14} max={365} onChange={(v) => set("goalDays", v)} />
                <Slider label="Готов(а) выкладывать" value={settings.postsPerWeek} display={`${settings.postsPerWeek} видео/нед`} min={1} max={21} onChange={(v) => set("postsPerWeek", v)} />
                <Slider label="Времени на контент" value={settings.hoursPerWeek} display={`${settings.hoursPerWeek} ч/нед`} min={1} max={40} onChange={(v) => set("hoursPerWeek", v)} />
              </div>
              {settings.postsPerWeek < 5 && <p className="mt-4 rounded-xl bg-amber/10 p-3 text-xs text-amber">Совет: для быстрого роста лучше 5+ видео в неделю — алгоритму нужно больше попыток.</p>}
            </div>
          )}

          {step === "about" && (
            <div>
              <h2 className="font-display text-2xl font-bold">Пара слов о тебе</h2>
              <p className="mt-2 text-sm text-white/55">Чтобы идеи подходили под твои возможности.</p>
              <div className="mt-6 space-y-5">
                <div>
                  <div className="mb-2 text-sm text-white/70">Опыт в TikTok</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["new", "Новичок"],
                        ["some", "Немного снимал(а)"],
                        ["pro", "Опытный"],
                      ] as const
                    ).map(([k, l]) => (
                      <Toggle key={k} active={settings.experience === k} onClick={() => set("experience", k)}>
                        {l}
                      </Toggle>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-white/70">Показываешь лицо в кадре?</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Toggle active={settings.faceOnCamera} onClick={() => set("faceOnCamera", true)}>
                      <Camera className="size-4" /> Да
                    </Toggle>
                    <Toggle active={!settings.faceOnCamera} onClick={() => set("faceOnCamera", false)}>
                      <CameraOff className="size-4" /> Нет, без лица
                    </Toggle>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm text-white/70">
                    Регион
                    <select value={settings.region} onChange={(e) => set("region", e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none">
                      {["RU", "KZ", "UA", "BY", "UZ", "US", "EU", "Весь мир"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-white/70">
                    Язык роликов
                    <select value={settings.language} onChange={(e) => set("language", e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none">
                      {["русский", "английский", "казахский", "украинский", "без слов"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm text-white/70">
                  Твоя фишка (необязательно)
                  <textarea
                    value={settings.strengths ?? ""}
                    onChange={(e) => set("strengths", e.target.value)}
                    rows={2}
                    placeholder="Например: занимаюсь танцами 5 лет, смешно пародирую, есть кот-актёр…"
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-pink/60"
                  />
                </label>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {step !== "connect" && (
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(steps[idx - 1])} icon={<ArrowLeft className="size-4" />}>
            Назад
          </Button>
          {step === "about" ? (
            <Button onClick={finish} size="lg" icon={loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}>
              Запустить ViralPilot
            </Button>
          ) : (
            <Button onClick={() => setStep(steps[idx + 1])} icon={<ArrowRight className="size-4" />}>
              Далее
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
        active ? "border-pink/60 bg-pink/15 text-white" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25",
      )}
    >
      {children}
    </button>
  );
}

function Slider({ label, value, display, min, max, onChange, log }: { label: string; value: number; display: string; min: number; max: number; onChange: (v: number) => void; log?: boolean }) {
  const toPos = (v: number) => (log ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min)) * 1000;
  const fromPos = (p: number) => {
    const f = p / 1000;
    const v = log ? Math.exp(Math.log(min) + f * (Math.log(max) - Math.log(min))) : min + f * (max - min);
    if (!log) return Math.round(v);
    const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    return Math.round(v / mag) * mag;
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="font-display font-bold text-gradient">{display}</span>
      </div>
      <input type="range" min={0} max={1000} value={toPos(value)} onChange={(e) => onChange(fromPos(Number(e.target.value)))} className="w-full accent-[#fe2c55]" />
    </div>
  );
}
