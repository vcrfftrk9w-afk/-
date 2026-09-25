"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera, CameraOff, Check, LogIn, PenLine, ScanLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NICHES } from "@/lib/knowledge";
import { detectNiche } from "@/lib/content";
import type { Account, NicheId, UserSettings } from "@/lib/types";
import { useStore } from "@/lib/store";
import { makeDemoAccount } from "@/lib/demo";
import { formatNum } from "@/lib/analytics";
import { Button, Card, cn } from "./ui";
import { toast } from "./toast";
import { DataImport, mergeImport } from "./data-import";
import { ScanAccount, type ScanResult } from "./scan-account";

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
  const guessed = initialAccount ? detectNiche(initialAccount.videos, initialAccount.profile.bio) : null;
  const [settings, setSettings] = useState<UserSettings>(() => (guessed ? { ...DEFAULT_SETTINGS, niche: guessed } : DEFAULT_SETTINGS));
  const [autoNiche, setAutoNiche] = useState<boolean>(Boolean(guessed));
  const [username, setUsername] = useState("");
  const [manualData, setManualData] = useState({ followers: "", likes: "", videos: "" });
  const [demo, setDemo] = useState(false);

  const set = <K extends keyof UserSettings>(k: K, v: UserSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const steps: Step[] = ["connect", "niche", "goals", "about"];
  const idx = steps.indexOf(step);

  const [others, setOthers] = useState(false);

  function onScanned(r: ScanResult) {
    setAccount({ source: "public", profile: r.profile, videos: r.videos, connectedAt: Date.now(), history: [{ t: Date.now(), followers: r.profile.followers, likes: r.profile.likes }] });
    setUsername(r.profile.username);
    const g = detectNiche(r.videos, r.profile.bio);
    if (g) {
      set("niche", g);
      setAutoNiche(true);
    }
    toast(r.videos.length ? `Аккаунт отсканирован: ${formatNum(r.profile.followers)} подписчиков, ${r.videos.length} роликов` : `Нашёл @${r.profile.username}: ${formatNum(r.profile.followers)} подписчиков`);
    setStep("niche");
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
              {!status?.static ? (
                <>
                  <h2 className="font-display text-2xl font-bold">Введи свой ник — остальное сделаю я</h2>
                  <p className="mt-2 text-sm text-white/55">Просканирую профиль и ролики, посчитаю, что у тебя залетает, и сразу дам план.</p>
                  <div className="mt-6">
                    <ScanAccount full={status?.scan === "full"} onDone={onScanned} onFail={() => setOthers(true)} />
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-bold">Покажи мне свой TikTok</h2>
                  <p className="mt-2 text-sm text-white/55">
                    Сканирование по @нику работает в полной версии со своим сервером: эта страница не может обращаться к TikTok. Здесь загрузи скриншоты или файл — цифры я прочитаю сам.
                  </p>
                  <div className="mt-6 rounded-2xl border border-pink/25 bg-gradient-to-br from-pink/[0.07] to-violet/[0.05] p-4">
                    <DataImport
                      onDone={(r) => {
                        const acc = mergeImport(null, r, "me");
                        setAccount(acc);
                        setUsername(acc.profile.username);
                        toast(`Данные загружены: ${formatNum(acc.profile.followers)} подписчиков, ${acc.videos.length} видео`);
                        setStep("niche");
                      }}
                    />
                  </div>
                </>
              )}

              <div className="mt-5 text-center">
                <button onClick={() => setOthers((o) => !o)} className="text-xs text-white/45 underline-offset-4 transition hover:text-white hover:underline">
                  {others ? "Скрыть другие способы" : "Другие способы подключения"}
                </button>
              </div>
              <AnimatePresence>
                {others && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-4 space-y-3">
                      {status?.tiktokOAuth && (
                        <a href="/api/tiktok/login" className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan/50">
                          <LogIn className="size-5 text-cyan" />
                          <div className="flex-1">
                            <div className="font-semibold">Войти через TikTok</div>
                            <div className="text-xs text-white/50">Официальный вход: все ролики и статистика</div>
                          </div>
                          <ArrowRight className="size-4 text-white/40" />
                        </a>
                      )}
                      {!status?.static && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                            <ScanLine className="size-4 text-pink" /> Скриншоты или файл аналитики TikTok Studio
                          </div>
                          <DataImport
                            compact
                            onDone={(r) => {
                              const acc = mergeImport(null, r, "me");
                              setAccount(acc);
                              toast(`Данные загружены: ${formatNum(acc.profile.followers)} подписчиков, ${acc.videos.length} видео`);
                              setStep("niche");
                            }}
                          />
                        </div>
                      )}
                      <div className="rounded-2xl bg-black/30 p-4">
                        <div className="mb-3 flex items-center gap-2 text-xs text-white/60">
                          <PenLine className="size-3.5" /> Ввести цифры профиля
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@ник" className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-cyan/60" />
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
                      <button onClick={startDemo} className="flex w-full items-center justify-center gap-2 rounded-2xl py-2 text-xs text-white/40 transition hover:text-white">
                        <Sparkles className="size-3.5" /> Посмотреть на примере (демо-цифры, не твои)
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
              <p className="mt-2 text-sm text-white/55">
                {autoNiche ? "Определил нишу по твоим роликам — поменяй, если не так." : "Под нишу я подберу тренды, форматы и стратегию."}
              </p>
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
            <Button onClick={finish} size="lg" icon={<Sparkles className="size-4" />}>
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
