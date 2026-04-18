import { motion } from "framer-motion";
import { PageHeader, GlassCard, NeuralBackground, RoboticDivider, HUDFrame } from "@/components/shared";
import {
  Layers, Brain, Cpu, Database, FileSearch, Zap,
  Shield, BarChart3, Globe, ArrowRight, Workflow, BookOpen
} from "lucide-react";

const layers = [
  { icon: FileSearch, title: "Document Ingestion", desc: "Upload single files, batches, or ZIP folders. Supports PDF, images, and structured documents." },
  { icon: Brain, title: "Intelligent Parsing", desc: "AI-powered document parsing with OCR, layout analysis, and content extraction." },
  { icon: Database, title: "Schema Intelligence", desc: "Auto-suggest schemas, manage definitions, and apply structured extraction templates." },
  { icon: BookOpen, title: "Alias Learning", desc: "Adaptive field mapping with alias registry, approval workflows, and memory persistence." },
  { icon: Cpu, title: "Multi-Engine Extraction", desc: "Auto, Python, AI, and Hybrid modes with provider selection (Groq, LandingAI, OpenAI)." },
  { icon: Zap, title: "Batch Processing", desc: "Run extractions at scale across document sets with job tracking and result management." },
  { icon: Shield, title: "Result Management", desc: "View, download, and export extraction results in JSON and structured formats." },
  { icon: Globe, title: "API Integration", desc: "RESTful API with full CRUD operations, health monitoring, and enterprise-grade reliability." },
];

const flow = [
  { step: "Upload", desc: "Documents enter the platform" },
  { step: "Parse", desc: "AI extracts content and structure" },
  { step: "Schema", desc: "Define or auto-suggest extraction schema" },
  { step: "Configure", desc: "Select engine and session settings" },
  { step: "Extract", desc: "Run intelligent data extraction" },
  { step: "Export", desc: "Download structured results" },
];

export default function ArchitecturePage() {
  return (
    <div className="relative min-h-screen">
      <NeuralBackground />

      <div className="relative z-10 pt-24 pb-16 px-6 max-w-6xl mx-auto">
        <PageHeader
          title="Platform Architecture"
          subtitle="A comprehensive look at the AQT Data Intelligence extraction platform"
        />

        {/* Overview */}
        <HUDFrame label="System Overview" className="mb-12">
          <GlassCard className="text-center">
            <div className="w-16 h-16 rounded-2xl glass-robot flex items-center justify-center mx-auto mb-4 relative">
              <Layers className="w-8 h-8 text-primary" />
              <div className="absolute inset-0 rounded-2xl animate-circuit-pulse" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-3">Agentic Document Extraction</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
              AQT Data Intelligence is a production-grade platform that transforms unstructured documents into structured data
              using multi-engine AI extraction, intelligent schema management, and adaptive alias learning.
            </p>
          </GlassCard>
        </HUDFrame>

        <RoboticDivider />

        {/* Architecture Layers */}
        <div className="mb-16">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-primary mb-2">System Modules</p>
            <h2 className="text-2xl font-display font-bold text-foreground">
              Architecture <span className="text-gradient">Layers</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {layers.map((l, i) => (
              <motion.div key={l.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                whileHover={{ y: -3 }}
                className="glass-robot p-6 group robot-corner"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg glass-robot flex items-center justify-center flex-shrink-0 group-hover:glow-primary transition-all">
                    <l.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground mb-1 text-sm">{l.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{l.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <RoboticDivider />

        {/* Extraction Flow */}
        <div className="mb-16">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-primary mb-2">Data Pipeline</p>
            <h2 className="text-2xl font-display font-bold text-foreground">
              Extraction <span className="text-gradient">Flow</span>
            </h2>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-3">
            {flow.map((f, i) => (
              <div key={f.step} className="flex items-center gap-3">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="glass-robot p-4 text-center min-w-[120px] scan-overlay"
                >
                  <div className="text-[9px] font-mono tracking-[0.2em] uppercase text-primary/50 mb-1">Step {String(i + 1).padStart(2, '0')}</div>
                  <p className="font-display font-bold text-foreground text-sm">{f.step}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{f.desc}</p>
                </motion.div>
                {i < flow.length - 1 && <ArrowRight className="w-4 h-4 text-primary/30 hidden md:block" />}
              </div>
            ))}
          </div>
        </div>

        <RoboticDivider />

        {/* Future Vision */}
        <HUDFrame label="Future Protocol">
          <GlassCard className="text-center">
            <BarChart3 className="w-10 h-10 text-accent mx-auto mb-3" />
            <h3 className="text-xl font-display font-bold text-foreground mb-2">Future-Ready Scaling</h3>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
              Built for horizontal scaling with modular engine architecture, pluggable providers,
              and enterprise-grade API design. Ready for production workloads at any scale.
            </p>
          </GlassCard>
        </HUDFrame>
      </div>
    </div>
  );
}
