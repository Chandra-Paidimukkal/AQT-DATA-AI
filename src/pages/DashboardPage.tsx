import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/services/api";
import { PageHeader, GlassCard, LoadingGrid, HUDFrame, RoboticDivider } from "@/components/shared";
import { FileText, Database, Workflow, Archive, Clock, Activity } from "lucide-react";

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.dashboardSummary();
        setSummary(res.data || res);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-6xl mx-auto">
      <PageHeader title="Dashboard" />
      <LoadingGrid count={4} />
    </div>
  );

  const metrics = [
    { label: "Documents", value: summary?.documents_count ?? 0, icon: FileText },
    { label: "Schemas", value: summary?.schemas_count ?? 0, icon: Database },
    { label: "Jobs", value: summary?.jobs_count ?? 0, icon: Workflow },
    { label: "Exports", value: summary?.exports_count ?? 0, icon: Archive },
  ];

  return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-6xl mx-auto">
      <PageHeader title="Dashboard" subtitle="Platform overview and system metrics" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {metrics.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-card p-6 text-center">
            <div className="w-11 h-11 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-3">
              <m.icon className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-display font-bold text-foreground">{m.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mt-1">{m.label}</p>
          </motion.div>
        ))}
      </div>

      <RoboticDivider />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
        <HUDFrame label="Recent Documents">
          <GlassCard>
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" /> Latest Documents
            </h3>
            <div className="space-y-1">
              {(summary?.latest_documents || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No documents indexed</p>
              ) : (
                (summary.latest_documents || []).map((doc: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                    <p className="text-sm text-foreground truncate">{doc.filename || doc.document_id}</p>
                    <span className="text-[10px] text-muted-foreground font-mono">{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : ""}</span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </HUDFrame>

        <HUDFrame label="Recent Jobs">
          <GlassCard>
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-glow-success" /> Latest Jobs
            </h3>
            <div className="space-y-1">
              {(summary?.latest_jobs || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No extraction jobs recorded</p>
              ) : (
                (summary.latest_jobs || []).map((job: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm text-foreground truncate">{job.filename || job.job_id}</p>
                      <span className="text-[10px] font-mono text-muted-foreground">{job.engine}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                      job.status === "completed" || job.status === "success"
                        ? "bg-glow-success/8 text-glow-success border-glow-success/15"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}>{job.status}</span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </HUDFrame>
      </div>
    </div>
  );
}
