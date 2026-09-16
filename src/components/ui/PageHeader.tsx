import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8"
    >
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-glow mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-ink-secondary mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  );
}
