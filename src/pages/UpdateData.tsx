import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import RealDataForm from "@/components/RealDataForm";
import { RealProfileInput } from "@/lib/realAnalysis";

export default function UpdateData() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const lastRealInput = useAppStore((s) => s.lastRealInput);
  const connectReal = useAppStore((s) => s.connectReal);
  const [justUpdated, setJustUpdated] = useState(false);

  if (!profile) return null;

  function handleSubmit(input: RealProfileInput) {
    connectReal(input);
    setJustUpdated(true);
    setTimeout(() => navigate("/dashboard"), 900);
  }

  return (
    <div>
      <PageHeader
        eyebrow={profile.dataMode === "real" ? "Обновление данных" : "Переход на реальные данные"}
        title="Обнови свою статистику"
        subtitle="Введи актуальные цифры из TikTok Studio — дашборд, тренды и план пересчитаются на основе твоих настоящих видео"
      />

      <Card>
        {justUpdated ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-16 flex flex-col items-center text-center gap-3"
          >
            <div className="h-16 w-16 rounded-full bg-good/20 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-good" />
            </div>
            <p className="font-bold text-lg">Данные обновлены!</p>
            <p className="text-sm text-ink-muted">Возвращаемся на дашборд...</p>
          </motion.div>
        ) : (
          <RealDataForm
            initialUsername={profile.username}
            initialNiche={profile.niche}
            initialInput={lastRealInput}
            submitLabel="Обновить дашборд"
            onSubmit={handleSubmit}
          />
        )}
      </Card>
    </div>
  );
}
