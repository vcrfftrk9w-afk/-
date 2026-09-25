"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Check, Loader2, Radar } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatNum } from "@/lib/analytics";
import type { TikTokProfile, TikTokVideo } from "@/lib/types";
import { Button, cn } from "./ui";

export interface ScanResult {
  profile: TikTokProfile;
  videos: TikTokVideo[];
  mode: "full" | "profile";
  warning?: string;
}

const STEPS = ["Ищу профиль", "Загружаю ролики", "Собираю статистику", "Готовлю анализ"];

/** Ввод @ника → сканирование аккаунта → предпросмотр найденного. */
export function ScanAccount({ onDone, onFail, full }: { onDone: (r: ScanResult) => void; onFail?: (msg: string) => void; full: boolean }) {
  const [u, setU] = useState("");
  const [phase, setPhase] = useState<"idle" | "scan" | "done">("idle");
  const [step, setStep] = useState(0);
  const [res, setRes] = useState<ScanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function scan() {
    const name = u.trim();
    if (!name) return;
    setErr(null);
    setPhase("scan");
    setStep(0);
    // Шаги прогресса: сканирование роликов занимает 20–90 секунд
    timer.current = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 2)), full ? 9000 : 1500);
    try {
      const r = await fetch(`/api/tiktok/scan?u=${encodeURIComponent(name)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `Ошибка ${r.status}`);
      setStep(STEPS.length - 1);
      setRes(j as ScanResult);
      setPhase("done");
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      setPhase("idle");
      onFail?.(msg);
    } finally {
      if (timer.current) clearInterval(timer.current);
    }
  }

  if (phase === "done" && res) {
    const p = res.profile;
    const top = [...res.videos].sort((a, b) => b.views - a.views).slice(0, 5);
    const totalViews = res.videos.reduce((s, v) => s + v.views, 0);
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-cyan/30 bg-cyan/5 p-4">
        <div className="flex items-center gap-3">
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" className="size-14 rounded-full object-cover ring-2 ring-cyan/50" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-pink font-display text-xl font-bold">{p.username[0]?.toUpperCase()}</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-display font-bold">
              {p.displayName} {p.verified && <BadgeCheck className="size-4 text-cyan" />}
            </div>
            <div className="text-sm text-white/55">@{p.username}</div>
            {p.bio && <div className="mt-0.5 line-clamp-1 text-xs text-white/45">{p.bio}</div>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Подписчики", formatNum(p.followers)],
            ["Лайки", formatNum(p.likes)],
            ["Видео", formatNum(p.videoCount)],
            [res.videos.length ? `Просмотры ${res.videos.length} роликов` : "Ролики", res.videos.length ? formatNum(totalViews) : "—"],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-black/30 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-white/40">{l}</div>
              <div className="mt-0.5 font-display text-base font-bold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        {top.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Лучшие ролики</div>
            {top.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-1.5 text-xs">
                <span className="flex-1 truncate text-white/75">{v.title || "Ролик без подписи"}</span>
                <span className="shrink-0 tabular-nums text-white/60">👁 {formatNum(v.views)}</span>
                <span className="shrink-0 tabular-nums text-white/45">❤️ {formatNum(v.likes)}</span>
              </div>
            ))}
          </div>
        )}
        {(res.warning || res.mode === "profile") && (
          <p className="mt-3 rounded-xl bg-amber/10 p-2.5 text-xs text-amber">
            {res.warning ?? "Загружены цифры профиля. Ролики со статистикой подтянутся, если добавить APIFY_TOKEN (см. README), или загрузи скриншоты во вкладке «Профиль»."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onDone(res)} icon={<Check className="size-4" />}>
            Это я, дальше
          </Button>
          <Button variant="ghost" onClick={() => setPhase("idle")}>
            Другой аккаунт
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-lg text-white/40">@</span>
          <input
            id="scan-username"
            value={u}
            disabled={phase === "scan"}
            onChange={(e) => setU(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && scan()}
            placeholder="твой ник в TikTok"
            autoComplete="off"
            className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 pl-10 pr-4 text-base outline-none transition focus:border-pink/60 disabled:opacity-60"
          />
        </div>
        <Button size="lg" className="w-full sm:w-auto" onClick={scan} disabled={!u.trim()} loading={phase === "scan"} icon={phase !== "scan" && <ArrowRight className="size-5" />}>
          {phase === "scan" ? "Сканирую…" : "Сканировать"}
        </Button>
      </div>

      <AnimatePresence>
        {phase === "scan" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-4 flex items-center gap-4 rounded-2xl bg-black/30 p-4">
              <div className="relative flex size-14 shrink-0 items-center justify-center">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-pink/40" />
                <span className="absolute inset-2 animate-pulse-ring rounded-full bg-cyan/30 [animation-delay:0.6s]" />
                <Radar className="relative size-6 text-white" />
              </div>
              <div className="flex-1 space-y-1.5">
                {STEPS.map((s, i) => (
                  <div key={s} className={cn("flex items-center gap-2 text-sm transition", i < step ? "text-white/50" : i === step ? "text-white" : "text-white/25")}>
                    {i < step ? <Check className="size-4 text-cyan" /> : i === step ? <Loader2 className="size-4 animate-spin text-pink" /> : <span className="size-4" />}
                    {s}
                    {i === 1 && i === step && full && <span className="text-xs text-white/40">— до минуты</span>}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {err && <p className="mt-3 rounded-xl bg-pink/10 p-3 text-sm text-[#ff9db0]">{err}</p>}
      {phase === "idle" && !err && (
        <p className="mt-2 text-xs text-white/40">{full ? "Загружу профиль и последние 30 роликов со статистикой. Аккаунт должен быть открытым." : "Загружу цифры профиля. Аккаунт должен быть открытым."}</p>
      )}
    </div>
  );
}
