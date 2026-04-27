import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/services/api";
import { PageHeader, GlassCard, StatusBadge, EmptyState, LoadingGrid, HUDFrame } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import { Workflow, Eye, Download, Trash2 } from "lucide-react";

export default function JobsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const fetchJobs = async () => {
    try {
      const res = await api.listJobs();
      setJobs(res.data?.items || res.data || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchJobs(); }, []);

  const viewResult = async (jobId: string) => {
    try {
      const res = await api.getJobResult(jobId);
      setSelectedResult(res.data || res);
    } catch (e: any) {
      toast({ title: "Failed to fetch result", description: e.message, variant: "destructive" });
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      await api.deleteJob(jobId);
      setJobs(prev => prev.filter(j => j.job_id !== jobId));
      toast({ title: "Job deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-6xl mx-auto">
      <PageHeader title="Jobs & Results" subtitle="View all extraction runs and their results" />

      {loading ? <LoadingGrid /> : jobs.length === 0 ? (
        <EmptyState icon={Workflow} title="No Jobs Yet" description="Run an extraction to see jobs here" />
      ) : (
        <HUDFrame label="Job Registry">
          <div className="space-y-3">
            {jobs.map((job, i) => (
              <motion.div
                key={job.job_id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-robot robot-corner p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-display font-medium text-foreground text-sm truncate">{job.filename || "Untitled"}</p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{job.job_id}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <StatusBadge status={job.status || "unknown"} />
                    {job.engine && <span className="text-[10px] font-mono text-muted-foreground">Engine: {job.engine}</span>}
                    {job.created_at && <span className="text-[10px] text-muted-foreground font-mono">{new Date(job.created_at).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => viewResult(job.job_id)} className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => {
                    const blob = new Blob([JSON.stringify(job, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `job_${job.job_id}.json`;
                    a.click();
                  }} className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteJob(job.job_id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </HUDFrame>
      )}

      {selectedResult && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
          <HUDFrame label="Job Output">
            <div className="glass-robot p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-display font-bold text-foreground">Job Result</h3>
                <button onClick={() => setSelectedResult(null)} className="text-muted-foreground hover:text-foreground text-sm font-mono">✕</button>
              </div>
              <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(selectedResult, null, 2)}
              </pre>
            </div>
          </HUDFrame>
        </motion.div>
      )}
    </div>
  );
}
