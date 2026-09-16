import { motion } from "framer-motion";
import { Users, Eye, Heart, CalendarDays, Sparkles, Rocket } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import CountUp from "@/components/ui/CountUp";
import ScoreGauge from "@/components/charts/ScoreGauge";
import MetricBars from "@/components/charts/MetricBars";
import PillarsChart from "@/components/charts/PillarsChart";
import PostingHeatmap from "@/components/charts/PostingHeatmap";
import GrowthLineChart from "@/components/charts/GrowthLineChart";
import { COACH_ADVICE } from "@/lib/analysis";

export default function Dashboard() {
  const profile = useAppStore((s) => s.profile);
  if (!profile) return null;

  const stats = [
    { icon: Users, label: "Подписчики", value: profile.followers, suffix: "" },
    { icon: Eye, label: "Средние просмотры", value: profile.avgViews, suffix: "" },
    { icon: Heart, label: "Вовлечённость", value: profile.engagementRate, suffix: "%", decimals: true },
    { icon: CalendarDays, label: "Постов в неделю", value: profile.postsPerWeek, suffix: "" },
  ];

  const monthDeltaPct = Math.round(
    ((profile.followers - profile.followersLastMonth) / Math.max(profile.followersLastMonth, 1)) * 100,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Твой профиль"
        title={`Привет, @${profile.username} 👋`}
        subtitle="Вот свежий разбор твоего контента и персональные рекомендации по росту"
        action={
          <Link
            to="/ideas"
            className="inline-flex items-center gap-2 bg-tiktok-gradient rounded-xl px-4 py-2.5 text-sm font-semibold shadow-glow-pink hover:opacity-90 transition-opacity"
          >
            <Sparkles size={16} /> Получить идеи для видео
          </Link>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <Card key={s.label} delay={i * 0.05}>
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-cyan-glow">
                <s.icon size={17} />
              </div>
              {s.label === "Подписчики" && (
                <span
                  className={`text-xs font-semibold ${monthDeltaPct >= 0 ? "text-good" : "text-critical"}`}
                >
                  {monthDeltaPct >= 0 ? "+" : ""}
                  {monthDeltaPct}% за месяц
                </span>
              )}
            </div>
            <p className="text-2xl font-extrabold tabular-nums">
              {s.decimals ? (
                <>
                  {s.value}
                  {s.suffix}
                </>
              ) : (
                <CountUp value={s.value} format={(v) => v.toLocaleString("ru-RU") + s.suffix} />
              )}
            </p>
            <p className="text-xs text-ink-muted mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-1 flex flex-col items-center justify-center text-center" delay={0.1}>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-4">
            Индекс роста
          </p>
          <ScoreGauge value={profile.growthScore} />
          <span className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-xs font-semibold">
            <Rocket size={12} className="text-cyan-glow" /> Уровень: {profile.tier}
          </span>
          {profile.projectedDaysTo[0] && (
            <p className="text-xs text-ink-muted mt-4 leading-relaxed">
              При текущем темпе до{" "}
              <span className="text-white font-semibold">
                {profile.projectedDaysTo[0].milestone.toLocaleString("ru-RU")}
              </span>{" "}
              подписчиков — примерно{" "}
              <span className="text-white font-semibold">{profile.projectedDaysTo[0].days} дней</span>
            </p>
          )}
        </Card>

        <Card className="lg:col-span-2" delay={0.15}>
          <p className="text-sm font-semibold mb-4">Метрики контента</p>
          <MetricBars metrics={profile.metrics} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card delay={0.2}>
          <p className="text-sm font-semibold mb-1">Рост подписчиков</p>
          <p className="text-xs text-ink-muted mb-4">Последние 10 недель</p>
          <GrowthLineChart data={profile.growthHistory} />
        </Card>
        <Card delay={0.25}>
          <p className="text-sm font-semibold mb-1">Лучшее время для публикаций</p>
          <p className="text-xs text-ink-muted mb-4">Наведи, чтобы увидеть вовлечённость слота</p>
          <PostingHeatmap data={profile.heatmap} bestSlot={profile.bestSlot} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card delay={0.3}>
          <p className="text-sm font-semibold mb-1">Баланс контент-пилларов</p>
          <p className="text-xs text-ink-muted mb-4">Насколько равномерно распределены темы</p>
          <PillarsChart pillars={profile.contentPillars} />
        </Card>

        <Card delay={0.35}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-tiktok-gradient flex items-center justify-center">
              <Sparkles size={15} />
            </div>
            <p className="text-sm font-semibold">Советы ИИ-коуча</p>
          </div>
          <div className="space-y-4">
            {profile.weakPoints.map((m, i) => {
              const advice = COACH_ADVICE[m.key];
              return (
                <motion.div
                  key={m.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5"
                >
                  <p className="text-sm font-semibold mb-1.5">{advice.title}</p>
                  <ul className="space-y-1">
                    {advice.tips.slice(0, 2).map((tip) => (
                      <li key={tip} className="text-xs text-ink-secondary flex gap-1.5">
                        <span className="text-cyan-glow shrink-0">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
