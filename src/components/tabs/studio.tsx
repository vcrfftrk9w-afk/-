"use client";
import { motion } from "framer-motion";
import { AlertOctagon, Camera, CheckCircle2, Circle, Clapperboard, Clock, Lightbulb, ListChecks, MessageSquareQuote, Music2, Scissors, Send, Sun, Trash2, Type, Wrench } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Card, Chip, CopyButton, Empty, SectionHeader, cn, fireConfetti } from "../ui";
import { useNav } from "../nav";
import { toast } from "../toast";

function Block({ icon, title, children, className }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="mb-3 flex items-center gap-2 font-display font-bold">
        {icon}
        {title}
      </div>
      {children}
    </Card>
  );
}

function Checklist({ items, id }: { items: string[]; id: string }) {
  const key = `vp:check:${id}`;
  const [done, setDone] = useState<Record<number, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}");
    } catch {
      return {};
    }
  });
  const toggle = (i: number) => {
    const next = { ...done, [i]: !done[i] };
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <button key={i} onClick={() => toggle(i)} className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left text-sm transition hover:bg-white/5">
          {done[i] ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan" /> : <Circle className="mt-0.5 size-4 shrink-0 text-white/30" />}
          <span className={cn(done[i] ? "text-white/40 line-through" : "text-white/80")}>{it}</span>
        </button>
      ))}
    </div>
  );
}

export function Studio() {
  const { state, update, addXp } = useStore();
  const { go } = useNav();
  const scripts = Object.entries(state.scripts).sort((a, b) => b[1].createdAt - a[1].createdAt);
  const activeId = state.activeScriptId && state.scripts[state.activeScriptId] ? state.activeScriptId : scripts[0]?.[0];
  const active = activeId ? state.scripts[activeId] : null;

  if (!active) {
    return (
      <div>
        <SectionHeader icon={<Clapperboard className="size-7 text-violet" />} title="Студия" subtitle="Готовые сценарии с посекундной раскадровкой — бери телефон и снимай." />
        <Empty icon={<Clapperboard className="size-7" />} title="Сценариев пока нет" text="Выбери идею или тренд и нажми «Как снять» — я распишу всё: от хука до подписи." action={<Button onClick={() => go("ideas")}>К идеям</Button>} />
      </div>
    );
  }

  const p = active.plan;
  const fullCaption = `${p.caption}\n\n${p.hashtags.join(" ")}`;

  const posted = () => {
    addXp(60);
    fireConfetti();
    toast("Видео выложено! +60 XP. Теперь первый час — отвечай на комментарии 💬");
  };
  const remove = () => {
    if (!activeId) return;
    update((s) => {
      const next = { ...s.scripts };
      delete next[activeId];
      return { scripts: next, activeScriptId: null };
    });
  };

  return (
    <div>
      <SectionHeader icon={<Clapperboard className="size-7 text-violet" />} title="Студия" subtitle="Посекундная раскадровка, что говорить, как снимать и монтировать." />

      {scripts.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {scripts.map(([id, s]) => (
            <button
              key={id}
              onClick={() => update(() => ({ activeScriptId: id }))}
              className={cn("max-w-[220px] shrink-0 truncate rounded-2xl px-4 py-2.5 text-left text-sm font-semibold transition", id === activeId ? "bg-white text-black" : "bg-white/5 text-white/65 hover:bg-white/10")}
            >
              {s.plan.title}
            </button>
          ))}
        </div>
      )}

      <Card glow className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Chip tone={p.source === "ai" ? "lime" : "default"}>{p.source === "ai" ? "AI-сценарий" : "Шаблон"}</Chip>
              <Chip tone="cyan">
                <Clock className="size-3" /> ~{active.idea.durationSec}с
              </Chip>
              <Chip tone="violet">Выложить: {p.postingTime}</Chip>
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold">{p.title}</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/60">{active.idea.concept}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button onClick={posted} icon={<Send className="size-4" />}>
              Снял(а) и выложил(а)
            </Button>
            <button onClick={remove} className="rounded-xl p-3 text-white/35 hover:bg-white/10 hover:text-pink" title="Удалить сценарий">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </Card>

      <Block icon={<MessageSquareQuote className="size-5 text-pink" />} title="Хуки для A/B-теста" className="mb-5">
        <div className="grid gap-2 md:grid-cols-3">
          {p.hookVariants.map((h, i) => (
            <div key={i} className="flex items-start justify-between gap-2 rounded-2xl bg-gradient-to-br from-pink/10 to-violet/5 p-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Вариант {String.fromCharCode(65 + i)}</div>
                <div className="mt-1 text-sm font-semibold">«{h}»</div>
              </div>
              <CopyButton text={h} />
            </div>
          ))}
        </div>
      </Block>

      <Block icon={<Clapperboard className="size-5 text-cyan" />} title="Раскадровка" className="mb-5">
        <div className="relative space-y-4 pl-6">
          <div className="absolute bottom-2 left-[9px] top-2 w-px bg-gradient-to-b from-cyan via-violet to-pink" />
          {p.scenes.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="relative">
              <div className="absolute -left-6 top-1 flex size-[18px] items-center justify-center rounded-full border-2 border-[#0f0f18] bg-gradient-to-br from-cyan to-pink" />
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-white/10 px-2 py-0.5 font-display text-xs font-bold">{s.t}</span>
                  <span className="flex items-center gap-1.5 text-xs text-white/50">
                    <Camera className="size-3.5" /> {s.shot}
                  </span>
                </div>
                <div className="text-sm text-white/85">{s.action}</div>
                {s.onScreenText && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Type className="size-3.5 text-amber" />
                    <span className="text-amber">Текст на экране:</span>
                    <span className="text-white/80">«{s.onScreenText}»</span>
                  </div>
                )}
                {s.voiceover && (
                  <div className="mt-1.5 flex items-start gap-2 text-xs">
                    <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-cyan" />
                    <span className="text-white/70">«{s.voiceover}»</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Block>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Block icon={<ListChecks className="size-5 text-lime" />} title="Что снять (по порядку)">
          <Checklist key={`${activeId}-shots`} items={p.shotList} id={`${activeId}-shots`} />
        </Block>
        <Block icon={<Scissors className="size-5 text-violet" />} title="Монтаж">
          <ol className="space-y-2">
            {p.editing.map((e, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-violet/15 text-xs font-bold text-[#b69cff]">{i + 1}</span>
                <span className="pt-0.5 text-white/80">{e}</span>
              </li>
            ))}
          </ol>
        </Block>
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-3">
        <Block icon={<Wrench className="size-5 text-white/70" />} title="Оборудование">
          <ul className="space-y-1.5 text-sm text-white/75">
            {p.equipment.map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
        </Block>
        <Block icon={<Sun className="size-5 text-amber" />} title="Свет">
          <p className="text-sm text-white/75">{p.lighting}</p>
        </Block>
        <Block icon={<Music2 className="size-5 text-cyan" />} title="Звук">
          <p className="text-sm text-white/75">{p.sound}</p>
        </Block>
      </div>

      <Block icon={<Send className="size-5 text-pink" />} title="Публикация" className="mb-5">
        <div className="space-y-3">
          <div className="rounded-2xl bg-white/[0.03] p-4">
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-white/40">
              Подпись + хэштеги <CopyButton text={fullCaption} />
            </div>
            <p className="whitespace-pre-line text-sm text-white/85">{p.caption}</p>
            <p className="mt-2 text-sm text-cyan">{p.hashtags.join(" ")}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-white/40">
                Закреплённый комментарий <CopyButton text={p.pinnedComment} />
              </div>
              <p className="text-sm text-white/85">{p.pinnedComment}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <div className="mb-1 text-xs uppercase tracking-wider text-white/40">Призыв к действию</div>
              <p className="text-sm text-white/85">{p.cta}</p>
            </div>
          </div>
        </div>
      </Block>

      <div className="grid gap-5 lg:grid-cols-2">
        <Block icon={<CheckCircle2 className="size-5 text-cyan" />} title="Чек-лист перед публикацией">
          <Checklist key={`${activeId}-pre`} items={p.checklist} id={`${activeId}-pre`} />
        </Block>
        <Block icon={<AlertOctagon className="size-5 text-pink" />} title="Частые ошибки">
          <ul className="space-y-2 text-sm text-white/75">
            {p.mistakesToAvoid.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-pink">✕</span>
                {m}
              </li>
            ))}
          </ul>
        </Block>
      </div>

      <div className="mt-5 flex justify-center">
        <Button variant="soft" onClick={() => go("ideas")} icon={<Lightbulb className="size-4" />}>
          Ещё идеи
        </Button>
      </div>
    </div>
  );
}
