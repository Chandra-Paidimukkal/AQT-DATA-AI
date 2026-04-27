import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  Database, RefreshCw, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, Clock, Loader2, RotateCcw,
  Download, Trash2, FileText, X, Table2, Code2, Filter,
  AlertCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface JobDetail {
  job_id: string;
  document_id: string;
  filename: string;
  status: string;
  engine_used: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: string | null;
  error_message: string | null;
  columns: string[];          // ALL schema field names — used as table headers
  rows: Record<string, any>[]; // each row has ALL column keys
  row_count: number;
  field_count: number;
  extracted_raw: any;
}

interface Batch {
  batch_id: string;
  status: string;
  schema_name: string | null;
  schema_id: string | null;
  session: { session_id: string; mode: string; provider: string };
  document_count: number;
  completed_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: string | null;
  created_at: string | null;
  error_message: string | null;
  jobs?: JobDetail[];
  all_columns?: string[];
}

interface Stats { total: number; completed: number; partial: number; failed: number; running: number; }

// ── Status config ──────────────────────────────────────────────────────────────
const SC = {
  completed: { icon: CheckCircle2, label: "Completed", fg: "#10b981", bg: "rgba(16,185,129,0.09)", bd: "rgba(16,185,129,0.22)" },
  partial: { icon: AlertCircle, label: "Partial", fg: "#f59e0b", bg: "rgba(245,158,11,0.09)", bd: "rgba(245,158,11,0.22)" },
  failed: { icon: XCircle, label: "Failed", fg: "#ef4444", bg: "rgba(239,68,68,0.09)", bd: "rgba(239,68,68,0.22)" },
  running: { icon: Loader2, label: "Running", fg: "#38bdf8", bg: "rgba(56,189,248,0.09)", bd: "rgba(56,189,248,0.22)" },
  pending: { icon: Clock, label: "Pending", fg: "#94a3b8", bg: "rgba(148,163,184,0.09)", bd: "rgba(148,163,184,0.22)" },
};
function StatusBadge({ status }: { status: string }) {
  const c = SC[status as keyof typeof SC] ?? SC.pending;
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: c.fg, background: c.bg, border: `1px solid ${c.bd}` }}>
      <Icon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} style={{ color: c.fg }} />
      {c.label}
    </span>
  );
}

// ── Excel table — uses columns as headers, rows as data ───────────────────────
function SchemaExcelTable({ columns, rows }: { columns: string[]; rows: Record<string, any>[] }) {
  if (!columns.length) {
    return <p className="text-xs font-mono py-4 text-center" style={{ color: "#475569" }}>No schema columns defined</p>;
  }

  const cell = (v: any): string => {
    if (v === null || v === undefined || v === "NULL") return "NULL";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  return (
    <div className="overflow-auto rounded-lg" style={{ border: "1px solid #1e3a5f", maxHeight: "380px" }}>
      <table className="text-xs border-collapse" style={{ minWidth: `${Math.max(columns.length * 150, 500)}px`, width: "100%" }}>
        <thead>
          <tr style={{ background: "#0a1f3d", position: "sticky", top: 0, zIndex: 3 }}>
            <th className="px-3 py-2 text-center font-mono font-semibold"
              style={{ color: "#64748b", borderRight: "1px solid #1e3a5f", borderBottom: "2px solid #38bdf8", width: "42px", minWidth: "42px" }}>
              #
            </th>
            {columns.map(col => (
              <th key={col} className="px-3 py-2 text-left font-mono font-semibold whitespace-nowrap"
                style={{ color: "#38bdf8", borderRight: "1px solid #1e3a5f", borderBottom: "2px solid #38bdf8", minWidth: "140px" }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="text-center py-6 font-mono"
                style={{ color: "#334155" }}>
                No data extracted
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "#071a2e" : "#091f38" }}>
                <td className="px-3 py-1.5 font-mono text-center"
                  style={{ color: "#334155", borderRight: "1px solid #152a4a", borderBottom: "1px solid #152a4a" }}>
                  {ri + 1}
                </td>
                {columns.map(col => {
                  const val = cell(row[col]);
                  const isNull = val === "NULL";
                  return (
                    <td key={col}
                      className="px-3 py-1.5 font-mono whitespace-nowrap overflow-hidden"
                      style={{
                        color: isNull ? "#253850" : "#cbd5e1",
                        borderRight: "1px solid #152a4a",
                        borderBottom: "1px solid #152a4a",
                        maxWidth: "200px",
                        textOverflow: "ellipsis",
                      }}
                      title={val}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Document result panel ─────────────────────────────────────────────────────
function DocResultPanel({ job, onClose }: { job: JobDetail; onClose: () => void }) {
  const [tab, setTab] = useState<"table" | "json">("table");

  const downloadCSV = () => {
    const cols = job.columns;
    if (!cols.length) return;
    const lines = [
      cols.join(","),
      ...job.rows.map(row =>
        cols.map(c => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${job.filename.replace(/\s/g, "_")}_result.csv`; a.click();
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(job.extracted_raw, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${job.filename.replace(/\s/g, "_")}_result.json`; a.click();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden mt-3"
      style={{ border: "1px solid #1e3a5f", background: "#071a2e" }}>

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid #1e3a5f", background: "#0a2038" }}>
        <div className="flex items-center gap-2.5">
          <FileText className="w-3.5 h-3.5" style={{ color: "#38bdf8" }} />
          <span className="text-xs font-medium truncate max-w-[260px]" style={{ color: "#e2e8f0" }}>
            {job.filename}
          </span>
          <StatusBadge status={job.status} />
          {job.row_count > 0 && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
              {job.row_count} row{job.row_count !== 1 ? "s" : ""} · {job.field_count} fields
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Tab toggle */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid #1e3a5f" }}>
            {([["table", Table2, "Table"], ["json", Code2, "JSON"]] as const).map(([t, Icon, lbl]) => (
              <button key={t} onClick={() => setTab(t as "table" | "json")}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono transition-all"
                style={{ background: tab === t ? "#38bdf8" : "transparent", color: tab === t ? "#000" : "#64748b" }}>
                <Icon className="w-3 h-3" /> {lbl}
              </button>
            ))}
          </div>
          <button onClick={downloadCSV}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded"
            style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
            <Download className="w-3 h-3" /> CSV
          </button>
          <button onClick={downloadJSON}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded"
            style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
            <Download className="w-3 h-3" /> JSON
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "#475569" }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error */}
      {job.status === "failed" && job.error_message && (
        <div className="px-4 py-3 text-xs font-mono"
          style={{ background: "rgba(239,68,68,0.07)", borderBottom: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          <span className="font-semibold">Error: </span>{job.error_message}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {tab === "table" ? (
          <SchemaExcelTable columns={job.columns} rows={job.rows} />
        ) : (
          <pre className="text-[10px] font-mono overflow-auto max-h-80 leading-relaxed"
            style={{ color: "#94a3b8", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(job.extracted_raw, null, 2)}
          </pre>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 flex items-center gap-4 text-[9px] font-mono"
        style={{ borderTop: "1px solid #1e3a5f", color: "#253850" }}>
        {job.started_at && <span>Started: {job.started_at}</span>}
        {job.completed_at && <span>Finished: {job.completed_at}</span>}
        {job.duration_seconds && <span>Duration: {job.duration_seconds}s</span>}
        {job.engine_used && <span>Engine: {job.engine_used}</span>}
      </div>
    </motion.div>
  );
}

// ── Batch Row ──────────────────────────────────────────────────────────────────
function BatchRow({ batch, onDelete, onRerun }: {
  batch: Batch;
  onDelete: (id: string) => void;
  onRerun: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);

  const loadDetail = async () => {
    if (detail) { setExpanded(e => !e); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/database/${batch.batch_id}`);
      const json = await res.json();
      setDetail(json.data);
      setExpanded(true);
    } catch { } finally { setLoading(false); }
  };

  const handleRerun = async () => {
    setRerunning(true);
    await onRerun(batch.batch_id);
    setRerunning(false);
  };

  const downloadAllCSV = () => {
    if (!detail?.jobs?.length) return;
    const allCols = detail.all_columns || [];
    const docCol = "__document";
    const headers = [docCol, ...allCols];
    const lines = [headers.join(",")];
    for (const job of detail.jobs) {
      for (const row of job.rows) {
        lines.push(headers.map(h =>
          h === docCol ? `"${job.filename}"` : `"${String(row[h] ?? "").replace(/"/g, '""')}"`
        ).join(","));
      }
      if (!job.rows.length) {
        // Still include the doc row with all NULLs
        lines.push(headers.map(h => h === docCol ? `"${job.filename}"` : `"NULL"`).join(","));
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `batch_${batch.batch_id.slice(0, 8)}_all.csv`; a.click();
  };

  const selectedJob = detail?.jobs?.find(j => j.job_id === selectedJobId) ?? null;

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{ border: "1px solid #1e3a5f", background: "#071a2e" }}>

      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.018] transition-colors"
        onClick={loadDetail}>
        <span style={{ color: "#334155", flexShrink: 0 }}>
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#38bdf8" }} />
            : expanded
              ? <ChevronDown className="w-4 h-4" />
              : <ChevronRight className="w-4 h-4" />
          }
        </span>

        <StatusBadge status={batch.status} />

        <div className="w-32 flex-shrink-0">
          <p className="text-[11px] font-mono" style={{ color: "#e2e8f0" }}>{batch.created_at?.slice(0, 10)}</p>
          <p className="text-[9px] font-mono" style={{ color: "#334155" }}>{batch.created_at?.slice(11)}</p>
        </div>

        <div className="flex-shrink-0 text-center w-16">
          <p className="text-sm font-bold" style={{ color: "#38bdf8" }}>{batch.document_count}</p>
          <p className="text-[9px] font-mono uppercase" style={{ color: "#334155" }}>docs</p>
        </div>

        <div className="min-w-0 w-44">
          <p className="text-[9px] font-mono uppercase" style={{ color: "#253850" }}>Schema</p>
          <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
            {batch.schema_name || <span style={{ color: "#253850", fontStyle: "italic" }}>none</span>}
          </p>
        </div>

        <div className="hidden md:block min-w-0 w-32">
          <p className="text-[9px] font-mono uppercase" style={{ color: "#253850" }}>Mode · Provider</p>
          <p className="text-xs truncate capitalize" style={{ color: "#94a3b8" }}>
            {batch.session.mode} · {batch.session.provider}
          </p>
        </div>

        <div className="hidden lg:flex items-center gap-2 flex-1">
          {batch.completed_count > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(16,185,129,0.09)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
              {batch.completed_count} ✓
            </span>
          )}
          {batch.failed_count > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(239,68,68,0.09)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {batch.failed_count} ✗
            </span>
          )}
          {batch.duration_seconds && (
            <span className="text-[9px] font-mono" style={{ color: "#253850" }}>{batch.duration_seconds}s</span>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {detail && (
            <button onClick={downloadAllCSV} title="Download all as CSV"
              className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: "#475569" }}>
              <Download className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleRerun} disabled={rerunning || batch.status === "running"} title="Re-run"
            className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40" style={{ color: "#475569" }}>
            {rerunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          </button>
          <button onClick={() => onDelete(batch.batch_id)} title="Delete"
            className="p-1.5 rounded-lg hover:bg-red-500/10" style={{ color: "#475569" }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && detail && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            style={{ borderTop: "1px solid #1e3a5f" }}>
            <div className="px-4 py-4">

              {/* Meta strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { label: "Batch ID", value: detail.batch_id.slice(0, 16) + "…" },
                  { label: "Session", value: detail.session.session_id.slice(0, 16) + "…" },
                  { label: "Started", value: detail.started_at || "—" },
                  { label: "Completed", value: detail.completed_at || "—" },
                ].map(m => (
                  <div key={m.label} className="px-3 py-2 rounded-lg"
                    style={{ background: "#0a2038", border: "1px solid #1e3a5f" }}>
                    <p className="text-[9px] font-mono uppercase mb-0.5" style={{ color: "#253850" }}>{m.label}</p>
                    <p className="text-[10px] font-mono truncate" style={{ color: "#64748b" }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Documents table */}
              <p className="text-[10px] font-mono uppercase mb-2"
                style={{ color: "#38bdf8", letterSpacing: "0.15em" }}>
                Documents ({detail.jobs?.length || 0})
              </p>
              <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #1e3a5f" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "#0a1f3d" }}>
                      {["#", "Document", "Status", "Rows", "Fields", "Duration", "Action"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-mono font-semibold"
                          style={{ color: "#38bdf8", borderBottom: "1px solid #1e3a5f" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.jobs || []).map((job, i) => {
                      const isSel = selectedJobId === job.job_id;
                      return (
                        <tr key={job.job_id}
                          style={{
                            background: isSel ? "rgba(56,189,248,0.06)" : i % 2 === 0 ? "#071a2e" : "#091f38",
                            borderLeft: isSel ? "2px solid #38bdf8" : "2px solid transparent",
                          }}>
                          <td className="px-3 py-2 font-mono" style={{ color: "#334155", borderBottom: "1px solid #152a4a" }}>{i + 1}</td>
                          <td className="px-3 py-2 max-w-[220px]" style={{ borderBottom: "1px solid #152a4a" }}>
                            <p className="text-xs font-medium truncate" style={{ color: "#e2e8f0" }} title={job.filename}>{job.filename}</p>
                            <p className="text-[9px] font-mono" style={{ color: "#253850" }}>{job.job_id.slice(0, 10)}…</p>
                          </td>
                          <td className="px-3 py-2" style={{ borderBottom: "1px solid #152a4a" }}>
                            <StatusBadge status={job.status} />
                          </td>
                          <td className="px-3 py-2 font-mono text-center" style={{ color: "#94a3b8", borderBottom: "1px solid #152a4a" }}>
                            {job.row_count || "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-center" style={{ color: "#94a3b8", borderBottom: "1px solid #152a4a" }}>
                            {job.field_count || "—"}
                          </td>
                          <td className="px-3 py-2 font-mono" style={{ color: "#334155", borderBottom: "1px solid #152a4a" }}>
                            {job.duration_seconds ? `${job.duration_seconds}s` : "—"}
                          </td>
                          <td className="px-3 py-2" style={{ borderBottom: "1px solid #152a4a" }}>
                            <button
                              onClick={() => setSelectedJobId(isSel ? null : job.job_id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono transition-all"
                              style={isSel
                                ? { background: "#38bdf8", color: "#000" }
                                : { background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }
                              }>
                              {isSel ? "Hide" : "View"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Selected doc result panel */}
              <AnimatePresence>
                {selectedJob && (
                  <DocResultPanel
                    key={selectedJob.job_id}
                    job={selectedJob}
                    onClose={() => setSelectedJobId(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DatabasePage() {
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (filter !== "all") params.append("status", filter);
      const res = await fetch(`/api/v1/database?${params}`);
      const json = await res.json();
      const d = json.data || {};
      setBatches(d.items || []);
      setStats(d.stats || null);
      setTotal(d.total || 0);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [filter, page]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  useEffect(() => {
    if (!batches.some(b => b.status === "running")) return;
    const id = setInterval(fetchBatches, 4000);
    return () => clearInterval(id);
  }, [batches, fetchBatches]);

  const deleteBatch = async (batchId: string) => {
    if (!confirm("Delete this extraction record and all its results?")) return;
    try {
      await fetch(`/api/v1/database/${batchId}`, { method: "DELETE" });
      setBatches(prev => prev.filter(b => b.batch_id !== batchId));
      toast({ title: "Deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const rerunBatch = async (batchId: string) => {
    try {
      const res = await fetch(`/api/v1/database/${batchId}/rerun`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Rerun failed");
      toast({ title: "Re-run started", description: `New batch: ${json.data?.new_batch_id?.slice(0, 12)}…` });
      await fetchBatches();
    } catch (e: any) {
      toast({ title: "Re-run failed", description: e.message, variant: "destructive" });
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="relative z-10 pt-[52px] min-h-screen" style={{ background: "#050f1e" }}>
      <div className="max-w-7xl mx-auto px-5 py-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#38bdf8" }} />
            <span className="text-[10px] uppercase tracking-[0.22em] font-mono" style={{ color: "#38bdf8" }}>
              Extraction Records
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-display font-bold" style={{
                background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Database
              </h1>
              <p className="text-sm mt-1" style={{ color: "#334155" }}>
                One record per extraction run — all documents, schema fields, and results
              </p>
            </div>
            <button onClick={fetchBatches}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
          <div className="mt-4 h-px" style={{ background: "linear-gradient(90deg, transparent, #1e3a5f, rgba(56,189,248,0.3), #1e3a5f, transparent)" }} />
        </motion.div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Total Runs", val: stats.total, color: "#e2e8f0" },
              { label: "Completed", val: stats.completed, color: "#10b981" },
              { label: "Partial", val: stats.partial, color: "#f59e0b" },
              { label: "Failed", val: stats.failed, color: "#ef4444" },
              { label: "Running", val: stats.running, color: "#38bdf8" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 text-center"
                style={{ background: "#071a2e", border: "1px solid #1e3a5f" }}>
                <p className="text-2xl font-display font-bold" style={{ color: s.color }}>{s.val}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: "#253850" }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Filter className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#334155" }} />
          {["all", "completed", "partial", "failed", "running"].map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={filter === f
                ? { background: "#38bdf8", color: "#000" }
                : { background: "rgba(56,189,248,0.05)", color: "#334155", border: "1px solid #1e3a5f" }
              }>
              {f}
            </button>
          ))}
          <span className="ml-auto text-[10px] font-mono" style={{ color: "#253850" }}>
            {total} record{total !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Records */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#38bdf8" }} />
          </div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Database className="w-14 h-14 mb-4" style={{ color: "rgba(56,189,248,0.15)" }} />
            <p className="text-base font-semibold" style={{ color: "#e2e8f0" }}>No extraction records yet</p>
            <p className="text-sm mt-1" style={{ color: "#334155" }}>Run an extraction to see records here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {batches.map((batch, idx) => (
              <motion.div key={batch.batch_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.025 }}>
                <BatchRow batch={batch} onDelete={deleteBatch} onRerun={rerunBatch} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
              style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
              ← Prev
            </button>
            <span className="text-xs font-mono" style={{ color: "#334155" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-4 py-2 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
              style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}