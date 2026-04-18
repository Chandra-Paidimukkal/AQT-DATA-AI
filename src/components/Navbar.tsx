import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import {
  Upload, LayoutDashboard, Workflow, FileText,
  Settings, BookOpen, FolderDown, Database, Menu, X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Extract", icon: Upload },
  { to: "/jobs", label: "Jobs", icon: Workflow },
  { to: "/schemas", label: "Schemas", icon: FileText },
  { to: "/sessions", label: "Sessions", icon: Settings },
  { to: "/aliases", label: "Aliases", icon: BookOpen },
  { to: "/files", label: "Files", icon: FolderDown },
  { to: "/architecture", label: "Arch", icon: Database },
];

export default function Navbar() {
  const location = useLocation();
  const isOnline = useHealthCheck();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "hsl(224 50% 4% / 0.85)",
        backdropFilter: "blur(24px) saturate(180%)",
        borderBottom: "1px solid hsl(224 26% 14%)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-5 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 flex-shrink-0">
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* Diamond shape logo mark */}
            <div
              className="w-7 h-7 rotate-45 rounded-sm"
              style={{
                background: "linear-gradient(135deg, hsl(190 75% 46% / 0.15), hsl(252 58% 52% / 0.15))",
                border: "1px solid hsl(190 75% 46% / 0.35)",
                boxShadow: "0 0 12px hsl(190 75% 46% / 0.15)",
              }}
            />
            <span className="absolute text-[10px] font-display font-bold text-primary">A</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-bold text-sm tracking-widest text-foreground">AQT</span>
              <span className="text-[8px] font-mono tracking-[0.18em] text-primary/60 uppercase">Nexus</span>
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-0.5">
          {navItems.map(item => {
            const active = location.pathname === item.to ||
              (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative px-3.5 py-1.5 rounded-md text-[11px] font-medium tracking-wide transition-all duration-150 ${active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground/80"
                  }`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md"
                    style={{
                      background: "hsl(190 75% 46% / 0.08)",
                      border: "1px solid hsl(190 75% 46% / 0.18)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wider"
            style={{ background: "hsl(224 44% 7% / 0.8)", border: "1px solid hsl(224 26% 14%)" }}
          >
            <span className="relative flex h-1.5 w-1.5">
              {isOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
              )}
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isOnline === null ? "bg-muted-foreground" :
                  isOnline ? "bg-emerald-400" : "bg-red-400"
                }`} />
            </span>
            <span className={isOnline ? "text-emerald-400/80" : "text-muted-foreground"}>
              {isOnline === null ? "connecting" : isOnline ? "online" : "offline"}
            </span>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ borderTop: "1px solid hsl(224 26% 14%)", background: "hsl(224 50% 4% / 0.97)" }}
            className="lg:hidden px-4 py-3"
          >
            <div className="grid grid-cols-2 gap-1">
              {navItems.map(item => {
                const active = location.pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${active
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}