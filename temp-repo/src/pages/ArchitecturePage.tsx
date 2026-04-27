import { motion } from "framer-motion";
import { NeuralBackground, RoboticDivider, SectionHeading } from "@/components/shared";
import {
  FileSearch, Brain, Database, BookOpen, Cpu, Zap, Shield, Globe,
  ArrowRight, Layers, BarChart3, CheckCircle2,
} from "lucide-react";

const layers = [
  {
    group: "Ingestion",
    color: "hsl(185 72% 44%)",
    bg: "hsl(185 72% 44% / 0.07)",
    bd: "hsl(185 72% 44% / 0.18)",
    items: [
      { icon: FileSearch, title: "Document Ingestion", desc: "Upload PDFs, images, ZIP folders. Supports batch and single file modes." },
      { icon: Brain, title: "Intelligent Parsing", desc: "AI-powered OCR, layout analysis, table detection, and text extraction." },
    ],
  },
  {
    group: "Intelligence",
    color: "hsl(248 55% 65%)",
    bg: "hsl(248 55% 55% / 0.07)",
    bd: "hsl(248 55% 55% / 0.18)",
    items: [
      { icon: Database, title: "Schema Intelligence", desc: "Auto-suggest schemas, manage definitions, and apply structured extraction templates." },
      { icon: BookOpen, title: "Alias Learning", desc: "Adaptive field mapping with alias registry, approval workflows, and memory persistence." },
    ],
  },
  {
    group: "Extraction",
    color: "hsl(34 82% 52%)",
    bg: "hsl(34 82% 46% / 0.07)",
    bd: "hsl(34 82% 46% / 0.18)",
    items: [
      { icon: Cpu, title: "Multi-Engine Extraction", desc: "Auto, Python, AI, and Hybrid modes. Provider support for Groq, LandingAI, OpenAI, Gemini." },
      { icon: Zap, title: "Batch Processing", desc: "Run extractions at scale with job tracking, retry logic, and result management." },
    ],
  },
  {
    group: "Output",
    color: "hsl(148 58% 46%)",
    bg: "hsl(148 58% 40% / 0.07)",
    bd: "hsl(148 58% 40% / 0.18)",
    items: [
      { icon: Shield, title: "Result Management", desc: "View, download, and export extraction results in JSON, CSV, and structured formats." },
      { icon: Globe, title: "API Integration", desc: "RESTful API with full CRUD, health monitoring, CORS support, and enterprise reliability." },
    ],
  },
];

const flow = [
  { step: "01", label: "Upload", desc: "Documents enter the platform", icon: FileSearch },
  { step: "02", label: "Parse", desc: "AI extracts content & structure", icon: Brain },
  { step: "03", label: "Schema", desc: "Define or auto-suggest fields", icon: Database },
  { step: "04", label: "Configure", desc: "Select engine & session", icon: Cpu },
  { step: "05", label: "Extract", desc: "Run intelligent data extraction", icon: Zap },
  { step: "06", label: "Export", desc: "Download structured results", icon: Shield },
];

const capabilities = [
  "4 extraction engines (Auto, Python, AI, Hybrid)",
  "5+ AI provider integrations",
  "Adaptive alias learning with memory persistence",
  "Batch processing with job tracking",
  "Schema auto-suggestion from document content",
  "Export to JSON, CSV, and structured formats",
  "RESTful API with full CRUD operations",
  "OCR fallback for scanned documents",
];

export default function ArchitecturePage() {
  return (
    <div className="relative min-h-screen">
      <NeuralBackground />

      <div className="relative z-10 max-w-5xl mx-auto px-5 pt-20 pb-16">

        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse-glow" />
            <span className="section-label">Platform Overview</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gradient-glow tracking-tight">
            Platform Architecture
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5 max-w-xl">
            A comprehensive look at the AQT Data Intelligence extraction platform — built for production workloads at any scale.
          </p>
          <div className="divider mt-5" />
        </motion.div>

        {/* Overview card */}
        <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-2xl p-6 mb-10 flex flex-col sm:flex-row items-center gap-6"
          style={{ background: "hsl(185 72% 44% / 0.04)", border: "1px solid hsl(185 72% 44% / 0.14)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "hsl(185 72% 44% / 0.1)", border: "1px solid hsl(185 72% 44% / 0.2)" }}>
            <Layers className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-1">Agentic Document Extraction</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AQT Data Intelligence transforms unstructured documents into structured data using multi-engine AI extraction,
              intelligent schema management, and adaptive alias learning — fully API-driven and production-ready.
            </p>
          </div>
        </motion.div>

        {/* Architecture layers */}
        <SectionHeading label="System Modules" title={<>Architecture <span className="text-gradient">Layers</span></>} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {layers.map((group, gi) => (
            <motion.div key={group.group}
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: gi * 0.08 }}
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${group.bd}` }}>
              {/* Group header */}
              <div className="px-4 py-2.5 flex items-center gap-2"
                style={{ background: group.bg, borderBottom: `1px solid ${group.bd}` }}>
                <span className="text-[10px] font-mono tracking-[0.18em] uppercase" style={{ color: group.color }}>
                  {group.group}
                </span>
              </div>
              {/* Items */}
              <div className="divide-y" style={{ background: "hsl(220 40% 7%)", borderColor: "hsl(220 24% 11%)" }}>
                {group.items.map((item, ii) => (
                  <motion.div key={item.title}
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                    viewport={{ once: true }} transition={{ delay: gi * 0.08 + ii * 0.05 }}
                    className="flex items-start gap-4 p-4 group"
                    style={{ borderColor: "hsl(220 24% 11%)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: group.bg, border: `1px solid ${group.bd}` }}>
                      <item.icon className="w-4.5 h-4.5" style={{ color: group.color, width: 18, height: 18 }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-0.5">{item.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <RoboticDivider />

        {/* Extraction Flow */}
        <SectionHeading label="Data Pipeline" title={<>Extraction <span className="text-gradient">Flow</span></>} accent="Six-stage pipeline from document upload to structured export" />

        <div className="relative mb-12">
          {/* Connector line */}
          <div className="hidden md:block absolute top-9 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, hsl(185 72% 44% / 0.08), hsl(185 72% 44% / 0.3), hsl(248 55% 55% / 0.3), hsl(148 58% 40% / 0.3), hsl(148 58% 40% / 0.08))" }} />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {flow.map((f, i) => (
              <motion.div key={f.label}
                initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="relative flex flex-col items-center text-center p-4 rounded-xl"
                style={{ background: "hsl(220 40% 7%)", border: "1px solid hsl(220 24% 13%)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 relative z-10"
                  style={{
                    background: `hsl(185 72% 44% / ${0.06 + i * 0.025})`,
                    border: `1px solid hsl(185 72% 44% / ${0.15 + i * 0.04})`,
                  }}>
                  <f.icon className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
                </div>
                <span className="text-[9px] font-mono text-primary/50 mb-0.5">{f.step}</span>
                <p className="text-xs font-semibold text-foreground mb-1">{f.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <RoboticDivider />

        {/* Capabilities */}
        <SectionHeading label="Platform Specifications" title={<>Core <span className="text-gradient">Capabilities</span></>} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-12">
          {capabilities.map((cap, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ background: "hsl(220 40% 7%)", border: "1px solid hsl(220 24% 13%)" }}>
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">{cap}</span>
            </motion.div>
          ))}
        </div>

        {/* Future scaling */}
        <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-2xl p-7 text-center"
          style={{ background: "hsl(248 55% 55% / 0.04)", border: "1px solid hsl(248 55% 55% / 0.14)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "hsl(248 55% 55% / 0.1)", border: "1px solid hsl(248 55% 55% / 0.2)" }}>
            <BarChart3 className="w-6 h-6 text-accent" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground mb-2">Enterprise-Ready Scaling</h3>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Modular engine architecture, pluggable AI providers, and a REST-first API design make AQT ready for
            horizontal scaling and production workloads at any volume.
          </p>
        </motion.div>

      </div>
    </div>
  );
}