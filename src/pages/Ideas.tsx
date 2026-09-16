import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Bookmark, BookmarkCheck, Clock, Gauge, Music2, Send } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { generateIdeas, VideoIdea } from "@/lib/ideas";

export default function Ideas() {
  const profile = useAppStore((s) => s.profile);
  const ideaVariantSeed = useAppStore((s) => s.ideaVariantSeed);
  const reshuffleIdeas = useAppStore((s) => s.reshuffleIdeas);
  const savedIdeas = useAppStore((s) => s.savedIdeas);
  const saveIdea = useAppStore((s) => s.saveIdea);
  const removeIdea = useAppStore((s) => s.removeIdea);
  const [count] = useState(4);

  const ideas = useMemo(() => {
    if (!profile) return [];
    return generateIdeas(profile, count, ideaVariantSeed);
  }, [profile, count, ideaVariantSeed]);

  if (!profile) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Генератор идей"
        title="Что снять дальше"
        subtitle="Готовые концепции под твою нишу: хук, план ролика, съёмка, звук и подпись"
        action={
          <button
            onClick={reshuffleIdeas}
            className="inline-flex items-center gap-2 glass rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={15} /> Новые идеи
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4 mb-10">
        {ideas.map((idea, i) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            index={i}
            saved={savedIdeas.some((s) => s.id === idea.id)}
            onSave={() => saveIdea(idea)}
            onRemove={() => removeIdea(idea.id)}
          />
        ))}
      </div>

      {savedIdeas.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BookmarkCheck size={18} className="text-cyan-glow" /> Сохранённые идеи ({savedIdeas.length})
          </h2>
          <div className="grid lg:grid-cols-2 gap-4">
            {savedIdeas.map((idea, i) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                index={i}
                saved
                onSave={() => {}}
                onRemove={() => removeIdea(idea.id)}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  index,
  saved,
  onSave,
  onRemove,
  compact,
}: {
  idea: VideoIdea;
  index: number;
  saved: boolean;
  onSave: () => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  return (
    <Card delay={index * 0.05} className="flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-glow mb-1">
            {idea.basedOnTrend}
          </p>
          <h3 className="font-bold leading-snug">{idea.title}</h3>
        </div>
        <button
          onClick={saved ? onRemove : onSave}
          className="shrink-0 h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label={saved ? "Убрать из сохранённых" : "Сохранить идею"}
        >
          {saved ? <BookmarkCheck size={15} className="text-cyan-glow" /> : <Bookmark size={15} />}
        </button>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 mb-3">
        <p className="text-xs font-semibold text-ink-muted mb-1 uppercase tracking-wide">Хук</p>
        <p className="text-sm font-medium">"{idea.hook}"</p>
      </div>

      {!compact && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wide">Структура ролика</p>
          <ul className="space-y-1">
            {idea.beats.map((b, i) => (
              <li key={i} className="text-xs text-ink-secondary flex gap-1.5">
                <span className="text-cyan-glow shrink-0">›</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wide">Как снимать</p>
          <ul className="space-y-1">
            {idea.shotList.map((s, i) => (
              <li key={i} className="text-xs text-ink-secondary flex gap-1.5">
                <span className="text-cyan-glow shrink-0">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-white/5 space-y-2">
        <p className="text-xs text-ink-secondary flex items-start gap-1.5">
          <Send size={13} className="mt-0.5 shrink-0 text-ink-muted" />
          <span className="italic">"{idea.caption}"</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {idea.hashtags.map((h) => (
            <span key={h} className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-glow/10 text-cyan-glow">
              {h}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-ink-muted pt-1">
          <span className="flex items-center gap-1">
            <Gauge size={12} /> {idea.difficulty}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} /> ~{idea.estMinutes} мин
          </span>
          <span className="flex items-center gap-1">
            <Music2 size={12} /> лучшее время: {idea.bestTimeToPost}
          </span>
        </div>
      </div>
    </Card>
  );
}
