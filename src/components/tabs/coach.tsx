"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, Eraser, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";
import { Card, Chip, Markdown, SectionHeader, cn } from "../ui";

const PROMPTS = [
  "Что мне выложить сегодня, чтобы залететь?",
  "Почему у меня мало просмотров?",
  "Разбери мой лучший ролик — почему он зашёл?",
  "Напиши сценарий на 15 секунд под тренд",
  "Как набрать первые 1000 подписчиков быстрее?",
  "Как попасть в рекомендации с нуля?",
  "Придумай серию роликов на неделю",
  "Как отвечать на хейт в комментариях?",
];

export function Coach() {
  const { state, update, status } = useStore();
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = state.chat;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming) return;
    setInput("");
    const history: ChatMessage[] = [...msgs, { role: "user", content: q }];
    update(() => ({ chat: [...history, { role: "assistant", content: "" }] }));
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: state.settings, account: state.account, messages: history }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Ошибка ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const snapshot = acc;
        update((s) => ({ chat: [...s.chat.slice(0, -1), { role: "assistant", content: snapshot }] }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        update((s) => ({ chat: [...s.chat.slice(0, -1), { role: "assistant", content: `⚠️ ${(e as Error).message}` }] }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      <SectionHeader
        icon={<Bot className="size-7 text-cyan" />}
        title="AI-коуч"
        subtitle="Личный продюсер, который знает твои цифры. Спрашивай что угодно."
        action={
          <div className="flex items-center gap-2">
            <Chip tone={status?.ai ? "lime" : "default"}>{status?.ai ? `● ${status.model}` : "Офлайн-режим"}</Chip>
            {msgs.length > 0 && (
              <button onClick={() => update(() => ({ chat: [] }))} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white">
                <Eraser className="size-3.5" /> Очистить
              </button>
            )}
          </div>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {msgs.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan/30 to-pink/30">
                <Bot className="size-8" />
              </motion.div>
              <div className="font-display text-lg font-bold">Чем помочь сегодня?</div>
              <p className="mt-1 max-w-sm text-sm text-white/50">Я вижу твою статистику, нишу и цели — ответы будут про тебя.</p>
              <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {PROMPTS.map((p) => (
                  <button key={p} onClick={() => send(p)} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/75 transition hover:border-pink/40 hover:text-white">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="mr-3 mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan/40 to-pink/40">
                    <Bot className="size-4" />
                  </div>
                )}
                <div className={cn("max-w-[85%] rounded-3xl px-4 py-3", m.role === "user" ? "rounded-br-lg bg-gradient-to-br from-pink to-[#c41f4a] text-sm text-white" : "rounded-bl-lg bg-white/[0.05]")}>
                  {m.role === "user" ? (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  ) : m.content ? (
                    <Markdown text={m.content} />
                  ) : (
                    <div className="flex gap-1 py-1">
                      {[0, 1, 2].map((k) => (
                        <motion.span key={k} className="size-2 rounded-full bg-white/50" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: k * 0.15 }} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={endRef} />
        </div>

        <div className="border-t border-white/5 p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 focus-within:border-pink/50">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Спроси про хуки, тренды, идеи, почему не растут просмотры…"
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
            />
            {streaming ? (
              <button onClick={() => abortRef.current?.abort()} className="flex size-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20" title="Остановить">
                <Square className="size-4 fill-white" />
              </button>
            ) : (
              <button onClick={() => send(input)} disabled={!input.trim()} className="btn-glow flex size-10 items-center justify-center rounded-xl disabled:opacity-40" title="Отправить">
                <ArrowUp className="size-5" />
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
