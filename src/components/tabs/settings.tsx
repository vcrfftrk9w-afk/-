"use client";
import { BadgeCheck, Bot, CircleCheck, CircleX, Link2, LogIn, LogOut, Plus, RefreshCw, Settings, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore, xpLevel } from "@/lib/store";
import { getJSON } from "@/lib/api";
import { NICHES } from "@/lib/knowledge";
import { extractHashtags, formatNum } from "@/lib/analytics";
import type { NicheId, TikTokProfile, TikTokVideo, UserSettings } from "@/lib/types";
import { Button, Card, Chip, SectionHeader, cn } from "../ui";
import { toast } from "../toast";
import { DataImport, mergeImport } from "../data-import";

export function SettingsTab() {
  const router = useRouter();
  const { state, update, reset, status, refreshStatus } = useStore();
  const acc = state.account!;
  const [s, setS] = useState<UserSettings>(state.settings!);
  const [refreshing, setRefreshing] = useState(false);
  const [v, setV] = useState({ title: "", url: "", views: "", likes: "", comments: "", shares: "", duration: "", date: new Date().toISOString().slice(0, 16) });
  const [adding, setAdding] = useState(false);
  const lv = xpLevel(state.xp);

  const set = <K extends keyof UserSettings>(k: K, val: UserSettings[K]) => setS((x) => ({ ...x, [k]: val }));

  async function refresh() {
    setRefreshing(true);
    try {
      let profile: TikTokProfile;
      let videos: TikTokVideo[];
      if (acc.source === "oauth") {
        ({ profile, videos } = await getJSON<{ profile: TikTokProfile; videos: TikTokVideo[] }>("/api/tiktok/me"));
      } else if (acc.source === "public" && !status?.static) {
        ({ profile, videos } = await getJSON<{ profile: TikTokProfile; videos: TikTokVideo[] }>(`/api/tiktok/scan?u=${encodeURIComponent(acc.profile.username)}`));
        if (!videos.length) videos = acc.videos; // сканер не отдал ролики — сохраняем уже загруженные
      } else {
        toast("Загрузи свежие скриншоты или файл в блоке «Обновить данные» ниже", "info");
        return;
      }
      update((st) => ({
        account: {
          ...st.account!,
          profile,
          videos,
          history: [...(st.account?.history ?? []), { t: Date.now(), followers: profile.followers, likes: profile.likes }].slice(-120),
        },
      }));
      toast(`Данные обновлены: ${formatNum(profile.followers)} подписчиков, ${videos.length} видео`);
    } catch (e) {
      toast((e as Error).message, "warn");
    } finally {
      setRefreshing(false);
    }
  }

  async function addVideo() {
    setAdding(true);
    try {
      let title = v.title;
      let coverUrl: string | undefined;
      if (v.url.trim()) {
        try {
          const m = await getJSON<{ title: string; thumbnail: string }>(`/api/tiktok/oembed?url=${encodeURIComponent(v.url.trim())}`);
          title = title || m.title;
          coverUrl = m.thumbnail || undefined;
        } catch {
          /* ссылка не распознана — используем введённые данные */
        }
      }
      if (!title && !v.views) {
        toast("Укажи подпись или ссылку и хотя бы просмотры", "warn");
        return;
      }
      const video: TikTokVideo = {
        id: `m-${Date.now()}`,
        title,
        coverUrl,
        shareUrl: v.url || undefined,
        createTime: Math.floor(new Date(v.date).getTime() / 1000),
        duration: Number(v.duration) || 15,
        views: Number(v.views) || 0,
        likes: Number(v.likes) || 0,
        comments: Number(v.comments) || 0,
        shares: Number(v.shares) || 0,
        hashtags: extractHashtags(title),
      };
      update((st) => ({ account: { ...st.account!, videos: [video, ...st.account!.videos] } }));
      setV({ title: "", url: "", views: "", likes: "", comments: "", shares: "", duration: "", date: new Date().toISOString().slice(0, 16) });
      toast("Видео добавлено в анализ");
    } finally {
      setAdding(false);
    }
  }

  function save() {
    update(() => ({ settings: s }));
    toast("Настройки сохранены");
  }

  async function logout() {
    if (!confirm("Выйти и удалить все данные приложения на этом устройстве?")) return;
    await fetch("/api/tiktok/logout", { method: "POST" }).catch(() => {});
    reset();
    refreshStatus();
    router.replace("/");
  }

  const input = "h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-pink/60";

  return (
    <div>
      <SectionHeader icon={<Settings className="size-7 text-white/80" />} title="Профиль и настройки" />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card glow>
          <div className="flex items-center gap-4">
            {acc.profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={acc.profile.avatarUrl} alt="" className="size-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan to-pink font-display text-2xl font-bold">{acc.profile.username[0]?.toUpperCase()}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-display text-lg font-bold">
                {acc.profile.displayName} {acc.profile.verified && <BadgeCheck className="size-5 text-cyan" />}
              </div>
              <div className="text-sm text-white/50">@{acc.profile.username}</div>
              <div className="mt-1 text-xs text-white/40">{acc.profile.bio || "Био пустое"}</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {[
              ["Подписчики", acc.profile.followers],
              ["Лайки", acc.profile.likes],
              ["Видео", acc.profile.videoCount],
              ["В анализе", acc.videos.length],
            ].map(([l, n]) => (
              <div key={l as string} className="rounded-2xl bg-white/[0.03] p-2">
                <div className="font-display font-bold">{formatNum(n as number)}</div>
                <div className="text-[10px] text-white/45">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="violet">Уровень {lv.level}</Chip>
            <Chip tone="lime">{state.xp} XP</Chip>
            <Chip tone="pink">🔥 серия {state.streak.count} дн.</Chip>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="soft" size="sm" onClick={refresh} loading={refreshing} icon={<RefreshCw className="size-4" />}>
              Обновить данные
            </Button>
            {acc.source !== "oauth" && status?.tiktokOAuth && (
              <a href="/api/tiktok/login">
                <Button variant="outline" size="sm" icon={<LogIn className="size-4" />}>
                  Войти через TikTok
                </Button>
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut className="size-4" />}>
              Выйти и сбросить
            </Button>
          </div>
        </Card>

        <Card>
          <div className="mb-4 font-display font-bold">Подключения</div>
          <div className="space-y-3">
            <Integration
              icon={<Bot className="size-5" />}
              name="AI-мозг (Claude)"
              ok={!!status?.ai}
              okText={`Работает · ${status?.model}`}
              badText="Не настроен — работает офлайн-движок. Добавь ANTHROPIC_API_KEY в .env, чтобы включить AI-анализ, поиск трендов в интернете и умного коуча."
            />
            <Integration
              icon={<LogIn className="size-5" />}
              name="Вход через TikTok"
              ok={!!status?.tiktokOAuth}
              okText={status?.tiktokConnected ? "Настроен · аккаунт подключён" : "Настроен · можно войти"}
              badText="Не настроен. Добавь TIKTOK_CLIENT_KEY и TIKTOK_CLIENT_SECRET (developers.tiktok.com), чтобы загружать все видео со статистикой."
            />
            <div className="rounded-2xl bg-white/[0.03] p-3 text-xs text-white/50">
              Источник данных сейчас: <span className="text-white/80">{{ oauth: "официальный API TikTok", public: "публичная страница профиля", demo: "демо-данные (пример)", manual: "ручной ввод", import: "скриншоты и файлы TikTok" }[acc.source]}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-5" glow>
        <div className="mb-1 flex items-center gap-2 font-display font-bold">
          <RefreshCw className="size-5 text-pink" /> Обновить данные
        </div>
        <p className="mb-4 text-xs text-white/50">
          Загружай свежие скриншоты или файл из TikTok Studio раз в несколько дней — я сохраню историю и покажу реальный рост. Новые ролики добавятся, старые обновятся.
        </p>
        <DataImport
          compact
          onDone={(r) => {
            update((st) => ({ account: mergeImport(st.account, r), analysis: null }));
            toast(`Обновлено: ${r.videos.length} видео${r.profile.followers ? `, ${formatNum(r.profile.followers)} подписчиков` : ""}. Анализ пересчитан.`);
          }}
        />
      </Card>

      <Card className="mt-5">
        <div className="mb-4 font-display font-bold">Ниша и цели</div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-white/70">
            Ниша
            <select value={s.niche} onChange={(e) => set("niche", e.target.value as NicheId)} className={cn(input, "mt-2 bg-black/40")}>
              {NICHES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.emoji} {n.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-white/70">
            Уточнение ниши
            <input value={s.subNiche ?? ""} onChange={(e) => set("subNiche", e.target.value)} className={cn(input, "mt-2")} />
          </label>
          <label className="text-sm text-white/70">
            Цель, подписчиков
            <input inputMode="numeric" value={s.goalFollowers} onChange={(e) => set("goalFollowers", Number(e.target.value.replace(/\D/g, "")) || 0)} className={cn(input, "mt-2")} />
          </label>
          <label className="text-sm text-white/70">
            Срок, дней
            <input inputMode="numeric" value={s.goalDays} onChange={(e) => set("goalDays", Number(e.target.value.replace(/\D/g, "")) || 30)} className={cn(input, "mt-2")} />
          </label>
          <label className="text-sm text-white/70">
            Видео в неделю
            <input inputMode="numeric" value={s.postsPerWeek} onChange={(e) => set("postsPerWeek", Number(e.target.value.replace(/\D/g, "")) || 1)} className={cn(input, "mt-2")} />
          </label>
          <label className="text-sm text-white/70">
            Часов в неделю на контент
            <input inputMode="numeric" value={s.hoursPerWeek} onChange={(e) => set("hoursPerWeek", Number(e.target.value.replace(/\D/g, "")) || 1)} className={cn(input, "mt-2")} />
          </label>
          <label className="text-sm text-white/70 md:col-span-2">
            Твоя фишка
            <input value={s.strengths ?? ""} onChange={(e) => set("strengths", e.target.value)} className={cn(input, "mt-2")} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save}>Сохранить</Button>
          <label className="flex items-center gap-2 text-sm text-white/65">
            <input type="checkbox" checked={s.faceOnCamera} onChange={(e) => set("faceOnCamera", e.target.checked)} className="accent-[#fe2c55]" /> Показываю лицо в кадре
          </label>
        </div>
      </Card>

      <Card className="mt-5">
        <div className="mb-1 flex items-center gap-2 font-display font-bold">
          <Video className="size-5 text-cyan" /> Добавить одно видео вручную
        </div>
        <p className="mb-4 text-xs text-white/50">Если вход через TikTok не настроен — добавь статистику своих роликов (TikTok → Студия автора → Аналитика). Чем больше видео, тем точнее анализ.</p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
            <input value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="Ссылка на видео (необязательно)" className={cn(input, "pl-9")} />
          </div>
          <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Подпись с хэштегами" className={input} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["views", "Просмотры"],
              ["likes", "Лайки"],
              ["comments", "Комменты"],
              ["shares", "Репосты"],
              ["duration", "Длит., с"],
            ] as const
          ).map(([k, l]) => (
            <input key={k} inputMode="numeric" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/\D/g, "") })} placeholder={l} className={input} />
          ))}
          <input type="datetime-local" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={input} />
        </div>
        <Button className="mt-3" variant="soft" onClick={addVideo} loading={adding} icon={<Plus className="size-4" />}>
          Добавить
        </Button>

        {acc.videos.length > 0 && (
          <div className="mt-5 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {[...acc.videos]
              .sort((a, b) => b.createTime - a.createTime)
              .map((x) => (
                <div key={x.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="w-20 shrink-0 text-white/40">{new Date(x.createTime * 1000).toLocaleDateString("ru-RU")}</span>
                  <span className="flex-1 truncate text-white/75">{x.title || "Без подписи"}</span>
                  <span className="shrink-0 text-white/55">👁 {formatNum(x.views)}</span>
                  {(acc.source === "manual" || x.id.startsWith("m-")) && (
                    <button onClick={() => update((st) => ({ account: { ...st.account!, videos: st.account!.videos.filter((y) => y.id !== x.id) } }))} className="text-white/30 hover:text-pink">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Integration({ icon, name, ok, okText, badText }: { icon: React.ReactNode; name: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-3", ok ? "border-lime/20 bg-lime/5" : "border-white/8 bg-white/[0.02]")}>
      <div className="mt-0.5 text-white/70">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {name} {ok ? <CircleCheck className="size-4 text-lime" /> : <CircleX className="size-4 text-white/35" />}
        </div>
        <div className="mt-0.5 text-xs text-white/55">{ok ? okText : badText}</div>
      </div>
    </div>
  );
}
