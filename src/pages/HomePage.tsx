import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import { HUDFrame, RoboticDivider } from "@/components/shared";
import { api } from "@/services/api";
import heroRobot from "@/assets/hero-robot.png";
import {
  Brain, Upload, ArrowRight, Zap, Shield, Layers,
  FileSearch, Cpu, Download, ChevronRight,
  BarChart3, Database, Workflow
} from "lucide-react";

const steps = [
  { icon: FileSearch, title: "Parse", desc: "Upload & parse documents with AI-powered extraction" },
  { icon: Cpu, title: "AI Selection", desc: "Auto-select the optimal extraction engine" },
  { icon: Zap, title: "Extraction", desc: "Run intelligent data extraction at scale" },
  { icon: Download, title: "Download", desc: "Export structured results in any format" },
];

const features = [
  { icon: Brain, title: "Agentic AI", desc: "Autonomous document understanding and field extraction" },
  { icon: Layers, title: "Multi-Engine", desc: "Python, AI, Hybrid, and Auto modes for maximum flexibility" },
  { icon: Shield, title: "Schema Intelligence", desc: "Auto-suggest and manage extraction schemas" },
  { icon: BarChart3, title: "Enterprise Scale", desc: "Batch processing, job tracking, and alias learning" },
  { icon: Database, title: "Smart Storage", desc: "Organized file management with export capabilities" },
  { icon: Workflow, title: "Pipeline Ready", desc: "End-to-end extraction workflows with full control" },
];

export default function HomePage() {
  const isOnline = useHealthCheck();
  const baseUrl = api.getBaseUrl();

  return (
    <div className="relative min-h-screen">
      {/* Hero */}
      <section className="relative z-10 pt-28 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/50 border border-border text-xs text-muted-foreground mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                <span className="tracking-widest uppercase text-[10px]">Agentic Document Extraction</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-5 leading-[1.1]">
                <span className="text-foreground">Intelligent</span><br />
                <span className="text-gradient">Data Extraction</span>
              </h1>

              <p className="text-base text-muted-foreground max-w-lg mb-8 leading-relaxed">
                Transform unstructured documents into structured data with AI-powered extraction,
                multi-engine processing, and enterprise-grade reliability.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-3">
                <Link to="/upload">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="btn-primary">
                    Start Extracting <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </Link>
                <Link to="/architecture">
                  <motion.button whileHover={{ scale: 1.02 }}
                    className="btn-secondary">
                    View Architecture <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </Link>
              </div>

              <div className="flex items-center gap-8 mt-10">
                {[{ label: "Engines", val: "4" }, { label: "Providers", val: "5+" }, { label: "Formats", val: "∞" }].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.1 }} className="text-center">
                    <p className="text-2xl font-display font-bold text-primary">{s.val}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{s.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
              className="relative flex items-center justify-center">
              <div className="relative">
                <img src={heroRobot} alt="AQT AI" width={1024} height={1024}
                  className="w-full max-w-[420px] mx-auto animate-float drop-shadow-[0_0_30px_hsl(200,80%,55%,0.12)]" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[110%] h-[110%] rounded-full border border-primary/8 animate-rotate-slow" />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-primary/3 rounded-full blur-[60px]" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <RoboticDivider />

      {/* Steps */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Processing Pipeline</p>
            <h2 className="text-2xl font-display font-bold text-foreground">How It <span className="text-gradient">Works</span></h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-border" />
            {steps.map((step, i) => (
              <motion.div key={step.title} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.1 }} whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="glass-card p-6 text-center relative">
                <div className="w-12 h-12 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-[10px] font-mono tracking-widest text-muted-foreground mb-1">Step {String(i + 1).padStart(2, '0')}</div>
                <h3 className="font-display font-semibold text-foreground mb-1 text-sm">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <RoboticDivider />

      {/* Features */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Capabilities</p>
            <h2 className="text-2xl font-display font-bold text-foreground">Why <span className="text-gradient">AQT Intelligence</span></h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.08 }} whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="glass-card p-6 group cursor-default">
                <div className="w-10 h-10 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center mb-3 group-hover:bg-primary/12 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-1 text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Status */}
      <section className="relative z-10 py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <HUDFrame label="System Status">
            <div className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-glow-success" : isOnline === false ? "bg-destructive" : "bg-muted-foreground animate-pulse"}`} />
                  {isOnline && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-glow-success animate-ping opacity-25" />}
                </div>
                <span className="text-xs text-muted-foreground">
                  Backend: <span className={`font-medium ${isOnline ? "text-glow-success" : "text-destructive"}`}>
                    {isOnline === null ? "Checking…" : isOnline ? "Operational" : "Offline"}
                  </span>
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{baseUrl}</span>
            </div>
          </HUDFrame>
        </div>
      </section>
    </div>
  );
}
