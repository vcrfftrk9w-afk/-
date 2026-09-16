import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Info, ArrowRight, Loader2 } from "lucide-react";
import { NICHES } from "@/lib/niches";
import { Niche } from "@/lib/niches";
import { parseCount } from "@/lib/format";
import { RealProfileInput, RealVideoEntry } from "@/lib/realAnalysis";

interface VideoRowDraft {
  id: string;
  postedAt: string;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  topic: string;
}

function emptyRow(): VideoRowDraft {
  return {
    id: Math.random().toString(36).slice(2),
    postedAt: "",
    views: "",
    likes: "",
    comments: "",
    shares: "",
    topic: "",
  };
}

function rowFromEntry(v: RealVideoEntry): VideoRowDraft {
  return {
    id: v.id,
    postedAt: v.postedAt,
    views: String(v.views),
    likes: String(v.likes),
    comments: String(v.comments),
    shares: String(v.shares),
    topic: v.topic ?? "",
  };
}

export default function RealDataForm({
  initialUsername = "",
  initialNiche = null,
  initialInput = null,
  onSubmit,
  submitLabel = "Проанализировать мой аккаунт",
  submitting = false,
}: {
  initialUsername?: string;
  initialNiche?: Niche | null;
  initialInput?: RealProfileInput | null;
  onSubmit: (input: RealProfileInput) => void;
  submitLabel?: string;
  submitting?: boolean;
}) {
  const [username, setUsername] = useState(initialInput?.username ?? initialUsername);
  const [niche, setNiche] = useState<Niche | null>(initialInput?.niche ?? initialNiche);
  const [followers, setFollowers] = useState(
    initialInput ? String(initialInput.followers) : "",
  );
  const [followersLastMonth, setFollowersLastMonth] = useState(
    initialInput?.followersLastMonth ? String(initialInput.followersLastMonth) : "",
  );
  const [rows, setRows] = useState<VideoRowDraft[]>(
    initialInput && initialInput.videos.length > 0
      ? initialInput.videos.map(rowFromEntry)
      : [emptyRow(), emptyRow(), emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);

  const validRowCount = rows.filter((r) => r.postedAt && parseCount(r.views) > 0).length;

  function updateRow(id: string, patch: Partial<VideoRowDraft>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError("Укажи юзернейм TikTok");
      return;
    }
    if (!niche) {
      setError("Выбери нишу контента");
      return;
    }
    const followersNum = parseCount(followers);
    if (followersNum <= 0) {
      setError("Укажи реальное число подписчиков");
      return;
    }
    if (validRowCount === 0) {
      setError("Добавь хотя бы одно видео с датой публикации и просмотрами");
      return;
    }
    setError(null);

    const videos: RealVideoEntry[] = rows
      .filter((r) => r.postedAt && parseCount(r.views) > 0)
      .map((r) => ({
        id: r.id,
        postedAt: r.postedAt,
        views: parseCount(r.views),
        likes: parseCount(r.likes),
        comments: parseCount(r.comments),
        shares: parseCount(r.shares),
        topic: r.topic.trim() || undefined,
      }));

    onSubmit({
      username,
      niche,
      followers: followersNum,
      followersLastMonth: followersLastMonth ? parseCount(followersLastMonth) : undefined,
      videos,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="glass rounded-xl p-3.5 flex gap-2.5 text-xs text-ink-secondary">
        <Info size={15} className="text-cyan-glow shrink-0 mt-0.5" />
        <p>
          Все цифры бери из своего TikTok: профиль → значок «☰» → <b>TikTok Studio → Аналитика</b>{" "}
          — там подписчики и статистика по каждому видео. Или открой видео → «···» → «Аналитика
          видео». Числа можно вставлять как есть: <b>12.3K</b>, <b>1.2M</b>.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
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
            Подписчики сейчас
          </label>
          <input
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            placeholder="напр. 22.4K"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-glow/60 focus:bg-white/[0.07] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-ink-secondary mb-1.5 block">
          Подписчики месяц назад <span className="text-ink-muted font-normal">(необязательно — для прогноза роста)</span>
        </label>
        <input
          value={followersLastMonth}
          onChange={(e) => setFollowersLastMonth(e.target.value)}
          placeholder="напр. 18.7K"
          className="w-full sm:w-1/2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-glow/60 focus:bg-white/[0.07] transition-colors"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-ink-secondary mb-1.5 block">
          Ниша твоего контента
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
          {NICHES.map((nch) => (
            <button
              type="button"
              key={nch.id}
              onClick={() => setNiche(nch.id)}
              className={`rounded-xl px-2 py-2.5 text-xs font-medium border transition-all flex flex-col items-center gap-1 ${
                niche === nch.id
                  ? "border-cyan-glow/60 bg-cyan-glow/10 text-white"
                  : "border-white/10 bg-white/[0.03] text-ink-secondary hover:bg-white/[0.06]"
              }`}
            >
              <span className="text-base">{nch.emoji}</span>
              {nch.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-ink-secondary">
            Последние видео{" "}
            <span className="text-ink-muted font-normal">
              (чем больше — тем точнее анализ; заполнено: {validRowCount})
            </span>
          </label>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-glow hover:opacity-80"
          >
            <Plus size={14} /> Добавить видео
          </button>
        </div>

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {rows.map((row, i) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl bg-white/[0.03] border border-white/5 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-ink-muted">Видео {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="text-ink-muted hover:text-critical transition-colors"
                    aria-label="Удалить видео"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input
                    type="datetime-local"
                    value={row.postedAt}
                    onChange={(e) => updateRow(row.id, { postedAt: e.target.value })}
                    className="col-span-2 sm:col-span-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-cyan-glow/60"
                  />
                  <input
                    value={row.views}
                    onChange={(e) => updateRow(row.id, { views: e.target.value })}
                    placeholder="Просмотры"
                    className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-cyan-glow/60"
                  />
                  <input
                    value={row.likes}
                    onChange={(e) => updateRow(row.id, { likes: e.target.value })}
                    placeholder="Лайки"
                    className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-cyan-glow/60"
                  />
                  <input
                    value={row.comments}
                    onChange={(e) => updateRow(row.id, { comments: e.target.value })}
                    placeholder="Комменты"
                    className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-cyan-glow/60"
                  />
                  <input
                    value={row.shares}
                    onChange={(e) => updateRow(row.id, { shares: e.target.value })}
                    placeholder="Репосты"
                    className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-cyan-glow/60"
                  />
                </div>
                <input
                  value={row.topic}
                  onChange={(e) => updateRow(row.id, { topic: e.target.value })}
                  placeholder="Тема/хэштеги видео (необязательно): #танцы #тренд"
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-cyan-glow/60"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {error && <p className="text-xs text-critical">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-tiktok-gradient rounded-xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 shadow-glow-pink hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Считаем твою аналитику...
          </>
        ) : (
          <>
            {submitLabel} <ArrowRight size={16} />
          </>
        )}
      </button>
    </form>
  );
}
