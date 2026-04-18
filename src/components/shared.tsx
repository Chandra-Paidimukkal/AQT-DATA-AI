import { motion } from "framer-motion";
import { ReactNode, useEffect, useState } from "react";

// ── GlassCard ─────────────────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

export function GlassCard({ children, className = "", delay = 0, hover = true }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
      whileHover={hover ? { y: -3, transition: { duration: 0.2 } } : undefined}
      className={`glass-robot p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="mb-10"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {badge && (
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse-glow" />
              <span className="section-label">{badge}</span>
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-gradient-glow tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground text-sm mt-2 max-w-xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* Subtle divider under header */}
      <div className="divider mt-6 mb-0" />
    </motion.div>
  );
}

// ── HUDFrame ──────────────────────────────────────────────────────────────────
export function HUDFrame({
  label,
  children,
  className = "",
  accent = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Top label */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[9px] font-mono tracking-[0.22em] uppercase px-2 py-0.5 rounded"
          style={{
            color: accent ? "hsl(var(--glow-accent))" : "hsl(var(--primary) / 0.7)",
            background: accent ? "hsl(var(--glow-accent) / 0.08)" : "hsl(var(--primary) / 0.06)",
            border: `1px solid ${accent ? "hsl(var(--glow-accent) / 0.15)" : "hsl(var(--primary) / 0.12)"}`,
          }}
        >
          {label}
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "linear-gradient(90deg, hsl(var(--border)), transparent)" }}
        />
      </div>
      <div className="glass-robot robot-corner p-5">
        {children}
      </div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const map: Record<string, string> = {
    success: "pill-success",
    completed: "pill-success",
    failed: "pill-error",
    error: "pill-error",
    pending: "pill-warning",
    processing: "pill-info",
    running: "pill-info",
  };
  const cls = map[s] ?? "pill-muted";

  return (
    <span className={cls}>
      <span className="w-1 h-1 rounded-full bg-current animate-pulse-glow" />
      {status}
    </span>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: "hsl(var(--primary) / 0.06)",
          border: "1px solid hsl(var(--primary) / 0.12)",
        }}
      >
        <Icon className="w-7 h-7 text-primary/50" />
      </div>
      <h3 className="text-base font-display font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

// ── LoadingGrid ───────────────────────────────────────────────────────────────
export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-6"
          style={{
            background: "hsl(224 44% 7%)",
            border: "1px solid hsl(224 26% 14%)",
          }}
        >
          <div className="h-3 rounded-full bg-muted/50 w-3/4 mb-3 animate-pulse" />
          <div className="h-2.5 rounded-full bg-muted/30 w-1/2 mb-2 animate-pulse" style={{ animationDelay: "0.1s" }} />
          <div className="h-2.5 rounded-full bg-muted/20 w-2/3 animate-pulse" style={{ animationDelay: "0.2s" }} />
        </div>
      ))}
    </div>
  );
}

// ── RoboticDivider ────────────────────────────────────────────────────────────
export function RoboticDivider() {
  return (
    <div className="relative my-12 flex items-center justify-center">
      <div
        className="absolute inset-0 flex items-center"
        aria-hidden="true"
      >
        <div
          className="w-full h-px"
          style={{
            background: "linear-gradient(90deg, transparent, hsl(var(--border)), hsl(var(--primary) / 0.15), hsl(var(--border)), transparent)",
          }}
        />
      </div>
      <div
        className="relative px-4 py-1 rounded-full text-[9px] font-mono tracking-[0.25em] uppercase"
        style={{
          background: "hsl(var(--background))",
          color: "hsl(var(--primary) / 0.5)",
          border: "1px solid hsl(var(--border))",
        }}
      >
        ◈
      </div>
    </div>
  );
}

// ── NeuralBackground ──────────────────────────────────────────────────────────
export function NeuralBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Subtle top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, hsl(190 75% 46% / 0.06) 0%, transparent 65%)",
          filter: "blur(1px)",
        }}
      />
      {/* Bottom accent glow */}
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[400px]"
        style={{
          background: "radial-gradient(ellipse at 100% 100%, hsl(252 58% 52% / 0.03) 0%, transparent 60%)",
        }}
      />
      {/* Very subtle grid */}
      <div
        className="absolute inset-0 bg-grid-pattern"
        style={{ opacity: 0.25 }}
      />
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon: Icon,
  color = "primary",
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: any;
  color?: "primary" | "accent" | "success" | "warning";
  delay?: number;
}) {
  const colorMap = {
    primary: { text: "text-primary", bg: "hsl(var(--primary) / 0.08)", border: "hsl(var(--primary) / 0.15)" },
    accent: { text: "text-accent", bg: "hsl(var(--accent) / 0.08)", border: "hsl(var(--accent) / 0.15)" },
    success: { text: "text-emerald-400", bg: "hsl(145 62% 40% / 0.08)", border: "hsl(145 62% 40% / 0.15)" },
    warning: { text: "text-amber-400", bg: "hsl(36 85% 46% / 0.08)", border: "hsl(36 85% 46% / 0.15)" },
  };
  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-robot p-5 flex items-center gap-4"
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: c.bg, border: `1px solid ${c.border}` }}
      >
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono mt-1">{label}</p>
      </div>
    </motion.div>
  );
}

// ── DataTable ─────────────────────────────────────────────────────────────────
export function DataTable({
  columns,
  rows,
  emptyText = "No data",
}: {
  columns: { key: string; label: string; className?: string }[];
  rows: Record<string, ReactNode>[];
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground font-mono py-4 text-center">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: "1px solid hsl(224 26% 14%)" }}>
            {columns.map(col => (
              <th
                key={col.key}
                className={`pb-2 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-1 ${col.className ?? ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="transition-colors"
              style={{ borderBottom: i < rows.length - 1 ? "1px solid hsl(224 26% 12%)" : "none" }}
              onMouseEnter={e => (e.currentTarget.style.background = "hsl(224 44% 7%)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {columns.map(col => (
                <td key={col.key} className={`py-2.5 px-1 text-foreground ${col.className ?? ""}`}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}