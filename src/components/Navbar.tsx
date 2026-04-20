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
  { to: "/architecture", label: "Architecture", icon: Database },
];

export default function Navbar() {
  const location = useLocation();
  const isOnline = useHealthCheck();
  const [open, setOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "hsl(220 45% 4% / 0.88)",
        backdropFilter: "blur(24px) saturate(160%)",
        borderBottom: "1px solid hsl(220 24% 13%)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-5 h-[52px] flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rotate-45 rounded-sm"
              style={{ background: "hsl(185 72% 44% / 0.12)", border: "1px solid hsl(185 72% 44% / 0.3)" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-display font-bold text-primary">A</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-[13px] tracking-wide text-foreground group-hover:text-primary transition-colors">
              AQT
            </span>
            <span className="text-[8px] font-mono tracking-[0.2em] text-primary/50 uppercase">dATA</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
          {navItems.map(item => {
            const active = location.pathname === item.to ||
              (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to}
                className={`relative px-3 py-1.5 rounded-md text-[12px] font-medium tracking-wide transition-all duration-150 ${active ? "text-primary" : "text-muted-foreground hover:text-foreground/75"
                  }`}
              >
                {active && (
                  <motion.div layoutId="nav-pill"
                    className="absolute inset-0 rounded-md"
                    style={{ background: "hsl(185 72% 44% / 0.08)", border: "1px solid hsl(185 72% 44% / 0.18)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px]"
            style={{ background: "hsl(220 40% 7% / 0.8)", border: "1px solid hsl(220 24% 13%)" }}>
            <span className="relative flex h-1.5 w-1.5">
              {isOnline && <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-35" />}
              <span className={`relative rounded-full h-1.5 w-1.5 ${isOnline === null ? "bg-muted-foreground" : isOnline ? "bg-emerald-400" : "bg-red-400"
                }`} />
            </span>
            <span className={isOnline ? "text-emerald-400/75" : "text-muted-foreground"}>
              {isOnline === null ? "…" : isOnline ? "online" : "offline"}
            </span>
          </div>

          <button className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setOpen(!open)}>
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ borderTop: "1px solid hsl(220 24% 13%)", background: "hsl(220 45% 4% / 0.96)" }}
            className="lg:hidden px-4 py-3">
            <div className="grid grid-cols-2 gap-1">
              {navItems.map(item => {
                const active = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all ${active ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    style={active ? { background: "hsl(185 72% 44% / 0.08)", border: "1px solid hsl(185 72% 44% / 0.18)" } : {}}
                  >
                    <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
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