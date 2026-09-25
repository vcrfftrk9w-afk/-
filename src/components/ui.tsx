"use client";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import clsx from "clsx";
import { Check, Copy, Loader2, X } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { toast } from "./toast";

export const cn = clsx;

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, children, glow, delay = 0, ...rest }: React.HTMLAttributes<HTMLDivElement> & { glow?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn("glass rounded-3xl p-5", glow && "ring-gradient", className)}
      {...(rest as object)}
    >
      {children}
    </motion.div>
  );
}

// ── Button ──────────────────────────────────────────────────────────────────
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-9 px-3.5 text-sm",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-14 px-7 text-base",
        variant === "primary" && "btn-glow text-white",
        variant === "soft" && "bg-white/8 text-white hover:bg-white/12",
        variant === "ghost" && "text-white/70 hover:bg-white/5 hover:text-white",
        variant === "outline" && "border border-white/15 text-white hover:border-white/30 hover:bg-white/5",
        className,
      )}
      {...(rest as object)}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </motion.button>
  );
});

// ── Chip / Badge ────────────────────────────────────────────────────────────
export function Chip({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "cyan" | "pink" | "violet" | "lime" | "amber"; className?: string }) {
  const tones = {
    default: "bg-white/8 text-white/75",
    cyan: "bg-cyan/12 text-cyan",
    pink: "bg-pink/15 text-[#ff7a95]",
    violet: "bg-violet/15 text-[#b69cff]",
    lime: "bg-lime/12 text-lime",
    amber: "bg-amber/15 text-amber",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

// ── Progress ────────────────────────────────────────────────────────────────
export function Progress({ value, className, tone = "grad" }: { value: number; className?: string; tone?: "grad" | "cyan" | "pink" | "lime" }) {
  const bg = {
    grad: "bg-gradient-to-r from-cyan via-violet to-pink",
    cyan: "bg-cyan",
    pink: "bg-pink",
    lime: "bg-lime",
  }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/8", className)}>
      <motion.div
        className={cn("h-full rounded-full", bg)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/6", className)} />;
}

// ── Section header ──────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, icon, action }: { title: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-white/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Animated number ─────────────────────────────────────────────────────────
export function AnimatedNumber({ value, format = (n: number) => Math.round(n).toLocaleString("ru-RU"), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [inView, value, mv]);
  return <motion.span ref={ref} className={className}>{text}</motion.span>;
}

// ── Score ring ──────────────────────────────────────────────────────────────
export function ScoreRing({ score, size = 200, label }: { score: number; size?: number; label?: string }) {
  const stroke = size * 0.075;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = useRef(`g${Math.random().toString(36).slice(2, 7)}`).current;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-[12%] rounded-full bg-gradient-to-br from-cyan/20 via-violet/10 to-pink/25 blur-2xl" />
      <svg width={size} height={size} className="relative -rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#25f4ee" />
            <stop offset="55%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#fe2c55" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * Math.max(0, Math.min(100, score))) / 100 }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber value={score} className="font-display text-5xl font-bold" />
        <span className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">{label ?? "Viral Score"}</span>
      </div>
    </div>
  );
}

// ── Copy button ─────────────────────────────────────────────────────────────
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          toast("Скопировано");
          setTimeout(() => setOk(false), 1500);
        } catch {
          toast("Не удалось скопировать", "warn");
        }
      }}
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white", className)}
      title="Скопировать"
    >
      {ok ? <Check className="size-4 text-cyan" /> : <Copy className="size-4" />}
    </button>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, children, title, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className={cn("glass-strong relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-7", wide ? "sm:max-w-4xl" : "sm:max-w-xl")}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="font-display text-lg font-bold">{title}</div>
              <button onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Confetti ────────────────────────────────────────────────────────────────
const confettiListeners = new Set<() => void>();
export const fireConfetti = () => confettiListeners.forEach((l) => l());

export function Confetti() {
  const [bursts, setBursts] = useState<number[]>([]);
  useEffect(() => {
    const l = () => {
      const id = Date.now();
      setBursts((b) => [...b, id]);
      setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 2200);
    };
    confettiListeners.add(l);
    return () => {
      confettiListeners.delete(l);
    };
  }, []);
  const colors = ["#25f4ee", "#fe2c55", "#8b5cf6", "#b6ff3b", "#ffb547", "#ffffff"];
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {bursts.map((id) =>
        Array.from({ length: 70 }).map((_, i) => {
          const angle = Math.random() * Math.PI * 2;
          const dist = 180 + Math.random() * 380;
          return (
            <motion.span
              key={`${id}-${i}`}
              className="absolute left-1/2 top-1/2 block rounded-sm"
              style={{ width: 6 + Math.random() * 6, height: 10 + Math.random() * 8, background: colors[i % colors.length] }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 300, opacity: 0, rotate: Math.random() * 720 - 360 }}
              transition={{ duration: 1.6 + Math.random() * 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          );
        }),
      )}
    </div>
  );
}

// ── Markdown (лёгкий рендер для ответов коуча) ──────────────────────────────
function inline(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
export function Markdown({ text }: { text: string }) {
  const html: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      close();
      html.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
      if (list !== "ul") {
        close();
        html.push("<ul>");
        list = "ul";
      }
      html.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== "ol") {
        close();
        html.push("<ol>");
        list = "ol";
      }
      html.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^>\s?(.*)/))) {
      close();
      html.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else if (line.trim() === "") {
      close();
    } else {
      close();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  return <div className="md text-sm text-white/85" dangerouslySetInnerHTML={{ __html: html.join("") }} />;
}

// ── Логотип ─────────────────────────────────────────────────────────────────
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-xl bg-pink" />
        <div className="absolute inset-0 -translate-x-[2px] -translate-y-[2px] rounded-xl bg-cyan" />
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#111118]">
          <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none">
            <path d="M4 17 L10 11 L14 15 L20 7" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 7 H20 V12" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <span className="font-display text-lg font-bold tracking-tight">
        Viral<span className="text-gradient">Pilot</span>
      </span>
    </div>
  );
}

// ── Фон с «авророй» ─────────────────────────────────────────────────────────
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="grid-bg absolute inset-0" />
      <motion.div
        className="absolute -left-40 -top-40 size-[520px] rounded-full bg-cyan/20 blur-[120px]"
        animate={{ x: [0, 80, 0], y: [0, 60, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-40 top-20 size-[560px] rounded-full bg-pink/20 blur-[130px]"
        animate={{ x: [0, -70, 0], y: [0, 90, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-200px] left-1/3 size-[520px] rounded-full bg-violet/20 blur-[140px]"
        animate={{ x: [0, 60, -40, 0], y: [0, -40, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center py-14 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-white/5 text-white/70">{icon}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-white/55">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}

export function Thinking({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % lines.length), 2200);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <div className="flex items-center gap-3 text-sm text-white/60">
      <span className="relative flex size-3">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-pink/70" />
        <span className="relative inline-flex size-3 rounded-full bg-pink" />
      </span>
      <AnimatePresence mode="wait">
        <motion.span key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          {lines[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
