import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

// ── GlassCard ─────────────────────────────────────────────────────────────────
export function GlassCard({
  children, className = "", delay = 0, hover = true
}: { children: ReactNode; className?: string; delay?: number; hover?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      whileHover={hover ? { y: -2, transition: { duration: 0.15 } } : undefined}
      className={`glass-robot p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({
  title, subtitle, badge, action
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {badge && (
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse-glow" />
              <span className="section-label">{badge}</span>
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gradient-glow tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground text-sm mt-1.5 max-w-xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="flex-shrink-0 mt-1">{action}</div>}
      </div>
      <div className="divider mt-5" />
    </motion.div>
  );
}

// ── SectionHeading ────────────────────────────────────────────────────────────
export function SectionHeading({ label, title, accent }: { label: string; title: ReactNode; accent?: string }) {
  return (
    <div className="text-center mb-8">
      <span className="section-label block mb-2">{label}</span>
      <h2 className="text-2xl font-display font-bold text-foreground">{title}</h2>
      {accent && <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto">{accent}</p>}
    </div>
  );
}

// ── HUDFrame ──────────────────────────────────────────────────────────────────
export function HUDFrame({
  label, children, className = "", accent = false
}: {
  label: string; children: ReactNode; className?: string; accent?: boolean;
}) {
  const color = accent ? "hsl(var(--glow-accent))" : "hsl(var(--primary) / 0.65)";
  const bg = accent ? "hsl(var(--glow-accent) / 0.07)" : "hsl(var(--primary) / 0.05)";
  const bd = accent ? "hsl(var(--glow-accent) / 0.14)" : "hsl(var(--primary) / 0.1)";

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2.5 mb-2">
        <span
          className="text-[9px] font-mono tracking-[0.22em] uppercase px-2 py-0.5 rounded-md"
          style={{ color, background: bg, border: `1px solid ${bd}` }}
        >
          {label}
        </span>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(var(--border) / 0.8), transparent)" }} />
      </div>
      <div className="glass-robot robot-corner p-5">{children}</div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls: Record<string, string> = {
    success: "pill-success", completed: "pill-success",
    failed: "pill-error", error: "pill-error",
    pending: "pill-warning", processing: "pill-info", running: "pill-info",
  };
  return (
    <span className={cls[s] ?? "pill-muted"}>
      <span className="w-1 h-1 rounded-full bg-current animate-pulse-glow" />
      {status}
    </span>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon, title, description, action
}: { icon: any; title: string; description: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "hsl(var(--primary) / 0.06)", border: "1px solid hsl(var(--primary) / 0.1)" }}>
        <Icon className="w-6 h-6 text-primary/50" />
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
        <div key={i} className="rounded-xl p-6"
          style={{ background: "hsl(220 40% 7%)", border: "1px solid hsl(220 24% 13%)" }}>
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
    <div className="relative my-10 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full divider" />
      </div>
      <div className="relative px-3 py-0.5 rounded-full text-[9px] font-mono tracking-widest"
        style={{ background: "hsl(var(--background))", color: "hsl(var(--primary) / 0.4)", border: "1px solid hsl(var(--border))" }}>
        ◈
      </div>
    </div>
  );
}

// ── NeuralBackground ──────────────────────────────────────────────────────────
export function NeuralBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px]"
        style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(185 72% 44% / 0.06) 0%, transparent 60%)" }} />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px]"
        style={{ background: "radial-gradient(ellipse at 100% 100%, hsl(248 55% 55% / 0.03) 0%, transparent 60%)" }} />
      <div className="absolute inset-0 bg-grid-pattern" style={{ opacity: 0.18 }} />
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({
  label, value, icon: Icon, color = "primary", delay = 0
}: { label: string; value: string | number; icon: any; color?: "primary" | "accent" | "success" | "warning"; delay?: number }) {
  const map = {
    primary: { text: "text-primary", bg: "hsl(var(--primary) / 0.08)", bd: "hsl(var(--primary) / 0.14)" },
    accent: { text: "text-accent", bg: "hsl(var(--accent) / 0.08)", bd: "hsl(var(--accent) / 0.14)" },
    success: { text: "text-emerald-400", bg: "hsl(148 58% 40% / 0.08)", bd: "hsl(148 58% 40% / 0.14)" },
    warning: { text: "text-amber-400", bg: "hsl(34 82% 46% / 0.08)", bd: "hsl(34 82% 46% / 0.14)" },
  };
  const c = map[color];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="glass-robot p-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
        style={{ background: c.bg, border: `1px solid ${c.bd}` }}>
        <Icon className={`w-4 h-4 ${c.text}`} />
      </div>
      <div>
        <p className="text-xl font-display font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}