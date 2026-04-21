import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
    Database, RefreshCw, Eye, Download, Trash2, Play, X,
    CheckCircle2, XCircle, Clock, AlertCircle, Loader2,
    FileText, ChevronDown, ChevronRight, RotateCcw, Filter,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DbRecord {
    job_id: string;
    status: "completed" | "failed" | "running" | "pending";
    engine_used: string | null;
    created_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: string | null;
    error_message: string | null;
    field_count: number;
    result_file_path: string | null;
    document: { document_id: string; filename: string; content_type: string | null; uploaded_at: string | null };
    schema: { schema_id: string | null; schema_name: string | null };
    session: { session_id: string; mode: string | null; provider: string | null };
}

interface Stats {
    total: number; completed: number; failed: number; running: number; pending: number;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
    completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "hsl(148 55% 40% / 0.08)", bd: "hsl(148 55% 40% / 0.2)", label: "Completed" },
    failed: { icon: XCircle, color: "text-red-500", bg: "hsl(0 62% 46% / 0.08)", bd: "hsl(0 62% 46% / 0.22)", label: "Failed" },
    running: { icon: Loader2, color: "text-sky-500", bg: "hsl(199 88% 42% / 0.08)", bd: "hsl(199 88% 42% / 0.22)", label: "Running" },
    pending: { icon: Clock, color: "text-amber-500", bg: "hsl(36 85% 46% / 0.08)", bd: "hsl(36 85% 46% / 0.22)", label: "Pending" },
};

function StatusChip({ status }: { status: string }) {
    const cfg = STATUS[status as keyof typeof STATUS] ?? STATUS.pending;
    const Icon = cfg.icon;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ background: cfg.bg, border: `1px solid ${cfg.bd}`, color: cfg.color.replace("text-", "") }}>
            <Icon className={`w-3 h-3 ${cfg.color} ${status === "running" ? "animate-spin" : ""}`} />
            <span className={cfg.color}>{cfg.label}</span>
        </span>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DatabasePage() {
    const { toast } = useToast();

    const [records, setRecords] = useState<DbRecord[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const PAGE_SIZE = 30;

    const [viewingRecord, setViewingRecord] = useState<any | null>(null);
    const [viewLoading, setViewLoading] = useState(false);

    const [rerunning, setRerunning] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                page_size: String(PAGE_SIZE),
            });
            if (filter !== "all") params.append("status", filter);

            const res = await fetch(`/api/v1/database?${params}`);
            const json = await res.json();
            const data = json.data || {};
            setRecords(data.items || []);
            setStats(data.stats || null);
            setTotal(data.total || 0);
        } catch (e: any) {
            toast({ title: "Failed to load records", description: e.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [filter, page]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    // Auto-refresh if any record is running
    useEffect(() => {
        const hasRunning = records.some(r => r.status === "running");
        if (!hasRunning) return;
        const id = setInterval(fetchRecords, 3000);
        return () => clearInterval(id);
    }, [records, fetchRecords]);

    // ── View result ────────────────────────────────────────────────────────────
    const viewResult = async (jobId: string) => {
        setViewLoading(true);
        try {
            const res = await fetch(`/api/v1/database/${jobId}`);
            const json = await res.json();
            setViewingRecord(json.data || {});
        } catch (e: any) {
            toast({ title: "Failed to load result", description: e.message, variant: "destructive" });
        } finally {
            setViewLoading(false);
        }
    };

    // ── Rerun ──────────────────────────────────────────────────────────────────
    const rerun = async (jobId: string, filename: string) => {
        setRerunning(jobId);
        try {
            const res = await fetch(`/api/v1/database/${jobId}/rerun`, { method: "POST" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || "Rerun failed");
            toast({ title: "Rerun started", description: `New job: ${json.data?.new_job_id?.slice(0, 12)}…` });
            await fetchRecords();
        } catch (e: any) {
            toast({ title: "Rerun failed", description: e.message, variant: "destructive" });
        } finally {
            setRerunning(null);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────
    const deleteRecord = async (jobId: string) => {
        if (!confirm("Delete this extraction record?")) return;
        try {
            await fetch(`/api/v1/extraction/jobs/${jobId}`, { method: "DELETE" });
            setRecords(prev => prev.filter(r => r.job_id !== jobId));
            toast({ title: "Record deleted" });
        } catch (e: any) {
            toast({ title: "Delete failed", description: e.message, variant: "destructive" });
        }
    };

    // ── Download ───────────────────────────────────────────────────────────────
    const downloadResult = async (jobId: string, filename: string) => {
        try {
            const res = await fetch(`/api/v1/database/${jobId}`);
            const json = await res.json();
            const data = json.data?.result_data || {};
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `extraction_${filename.replace(/\s/g, "_")}_${jobId.slice(0, 8)}.json`;
            a.click();
        } catch (e: any) {
            toast({ title: "Download failed", description: e.message, variant: "destructive" });
        }
    };

    const toggleExpand = (id: string) =>
        setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const totalPages = Math.ceil(total / PAGE_SIZE);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="relative z-10 pt-[52px] min-h-screen">
            <div className="max-w-7xl mx-auto px-5 py-8">

                {/* ── Header ──────────────────────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-1 h-1 rounded-full bg-primary animate-pulse-glow" />
                        <span className="section-label">Extraction Records</span>
                    </div>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-3xl font-display font-bold text-foreground">Database</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Every extraction run — with full document, schema, result, and timing details
                            </p>
                        </div>
                        <button onClick={fetchRecords} className="btn btn-ghost btn-sm mt-1">
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </button>
                    </div>
                    <div className="divider mt-4" />
                </motion.div>

                {/* ── Stats bar ───────────────────────────────────────────────────── */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                        {[
                            { label: "Total Runs", value: stats.total, color: "text-foreground" },
                            { label: "Completed", value: stats.completed, color: "text-emerald-600" },
                            { label: "Failed", value: stats.failed, color: "text-red-500" },
                            { label: "Running", value: stats.running, color: "text-sky-500" },
                            { label: "Pending", value: stats.pending, color: "text-amber-500" },
                        ].map(s => (
                            <div key={s.label} className="glass-robot p-3.5 text-center">
                                <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
                                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Filter toolbar ───────────────────────────────────────────────── */}
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                    {["all", "completed", "failed", "running", "pending"].map(f => (
                        <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${filter === f
                                    ? "bg-primary text-white"
                                    : "glass-robot text-muted-foreground hover:text-foreground"
                                }`}>
                            {f}
                        </button>
                    ))}
                    <span className="ml-auto text-[11px] font-mono text-muted-foreground">{total} records</span>
                </div>

                {/* ── Table ───────────────────────────────────────────────────────── */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : records.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Database className="w-12 h-12 text-primary/20 mb-3" />
                        <p className="text-base font-semibold text-foreground">No extraction records yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Run an extraction to see records here</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {records.map((rec, idx) => {
                            const isExpanded = expanded.has(rec.job_id);
                            const isRerunning = rerunning === rec.job_id;

                            return (
                                <motion.div
                                    key={rec.job_id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.015 }}
                                    className="rounded-xl overflow-hidden"
                                    style={{ border: "1px solid hsl(var(--border))", background: "white" }}
                                >
                                    {/* ── Row ─────────────────────────────────────────────── */}
                                    <div className="flex items-center gap-3 px-4 py-3">

                                        {/* Expand toggle */}
                                        <button onClick={() => toggleExpand(rec.job_id)}
                                            className="text-muted-foreground hover:text-foreground flex-shrink-0">
                                            {isExpanded
                                                ? <ChevronDown className="w-4 h-4" />
                                                : <ChevronRight className="w-4 h-4" />
                                            }
                                        </button>

                                        {/* Status */}
                                        <StatusChip status={rec.status} />

                                        {/* Document */}
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <FileText className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                                                    {rec.document.filename}
                                                </p>
                                                <p className="text-[9px] font-mono text-muted-foreground">
                                                    {rec.job_id.slice(0, 12)}…
                                                </p>
                                            </div>
                                        </div>

                                        {/* Schema */}
                                        <div className="hidden md:block min-w-0 w-36">
                                            <p className="text-[10px] text-muted-foreground font-mono">Schema</p>
                                            <p className="text-xs text-foreground truncate">
                                                {rec.schema.schema_name || <span className="text-muted-foreground italic">none</span>}
                                            </p>
                                        </div>

                                        {/* Session */}
                                        <div className="hidden lg:block w-28">
                                            <p className="text-[10px] text-muted-foreground font-mono">Mode</p>
                                            <p className="text-xs text-foreground capitalize">
                                                {rec.session.mode || "—"} / {rec.session.provider || "—"}
                                            </p>
                                        </div>

                                        {/* Engine */}
                                        <div className="hidden lg:block w-28">
                                            <p className="text-[10px] text-muted-foreground font-mono">Engine</p>
                                            <p className="text-xs text-foreground">{rec.engine_used || "—"}</p>
                                        </div>

                                        {/* Fields extracted */}
                                        <div className="hidden sm:block w-16 text-center">
                                            <p className="text-[10px] text-muted-foreground font-mono">Fields</p>
                                            <p className={`text-sm font-bold ${rec.field_count > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                                                {rec.field_count}
                                            </p>
                                        </div>

                                        {/* Date / Time */}
                                        <div className="hidden md:block w-32 text-right">
                                            <p className="text-[10px] font-mono text-muted-foreground">
                                                {rec.created_at ? rec.created_at.replace(" UTC", "") : "—"}
                                            </p>
                                            {rec.duration_seconds && (
                                                <p className="text-[9px] font-mono text-muted-foreground/60">
                                                    {rec.duration_seconds}s
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-0.5 flex-shrink-0">
                                            {rec.status === "completed" && (
                                                <>
                                                    <button onClick={() => viewResult(rec.job_id)} title="View Result"
                                                        className="p-1.5 rounded-lg hover:bg-primary/8 text-muted-foreground hover:text-primary transition-colors">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => downloadResult(rec.job_id, rec.document.filename)} title="Download JSON"
                                                        className="p-1.5 rounded-lg hover:bg-primary/8 text-muted-foreground hover:text-primary transition-colors">
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={() => rerun(rec.job_id, rec.document.filename)} title="Re-run extraction"
                                                disabled={isRerunning || rec.status === "running"}
                                                className="p-1.5 rounded-lg hover:bg-sky-500/10 text-muted-foreground hover:text-sky-600 transition-colors disabled:opacity-40">
                                                {isRerunning
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <RotateCcw className="w-4 h-4" />
                                                }
                                            </button>
                                            <button onClick={() => deleteRecord(rec.job_id)} title="Delete"
                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Expanded detail row ──────────────────────────────── */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.18 }}
                                                style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--muted) / 0.3)" }}
                                            >
                                                <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                                                    {/* Document details */}
                                                    <div>
                                                        <p className="section-label mb-1.5">Document</p>
                                                        <p className="text-xs font-medium text-foreground">{rec.document.filename}</p>
                                                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 break-all">{rec.document.document_id}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">{rec.document.content_type || "—"}</p>
                                                        <p className="text-[10px] text-muted-foreground">Uploaded: {rec.document.uploaded_at || "—"}</p>
                                                    </div>

                                                    {/* Schema details */}
                                                    <div>
                                                        <p className="section-label mb-1.5">Schema</p>
                                                        <p className="text-xs font-medium text-foreground">{rec.schema.schema_name || "None (auto)"}</p>
                                                        {rec.schema.schema_id && (
                                                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5 break-all">{rec.schema.schema_id}</p>
                                                        )}
                                                    </div>

                                                    {/* Session details */}
                                                    <div>
                                                        <p className="section-label mb-1.5">Session</p>
                                                        <p className="text-xs font-medium text-foreground capitalize">
                                                            {rec.session.mode || "—"} · {rec.session.provider || "—"}
                                                        </p>
                                                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 break-all">{rec.session.session_id}</p>
                                                    </div>

                                                    {/* Timing details */}
                                                    <div>
                                                        <p className="section-label mb-1.5">Timing</p>
                                                        <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground">
                                                            <p>Created: {rec.created_at || "—"}</p>
                                                            <p>Started: {rec.started_at || "—"}</p>
                                                            <p>Finished: {rec.completed_at || "—"}</p>
                                                            <p>Duration: {rec.duration_seconds ? `${rec.duration_seconds}s` : "—"}</p>
                                                            <p>Engine: {rec.engine_used || "—"}</p>
                                                            <p>Fields extracted: {rec.field_count}</p>
                                                        </div>
                                                    </div>

                                                    {/* Error message for failed jobs */}
                                                    {rec.status === "failed" && rec.error_message && (
                                                        <div className="sm:col-span-2 lg:col-span-4">
                                                            <p className="section-label mb-1.5 text-red-500">Error</p>
                                                            <div className="p-3 rounded-lg text-xs font-mono text-red-700 break-all"
                                                                style={{ background: "hsl(0 62% 46% / 0.06)", border: "1px solid hsl(0 62% 46% / 0.18)" }}>
                                                                {rec.error_message}
                                                            </div>
                                                            <button
                                                                onClick={() => rerun(rec.job_id, rec.document.filename)}
                                                                disabled={isRerunning}
                                                                className="btn btn-primary btn-sm mt-3">
                                                                {isRerunning
                                                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Re-running…</>
                                                                    : <><Play className="w-3.5 h-3.5" /> Re-run from Scratch</>
                                                                }
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* ── Pagination ───────────────────────────────────────────────────── */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="btn btn-ghost btn-sm">← Prev</button>
                        <span className="text-sm font-mono text-muted-foreground">
                            Page {page} of {totalPages}
                        </span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="btn btn-ghost btn-sm">Next →</button>
                    </div>
                )}
            </div>

            {/* ── Result viewer modal ──────────────────────────────────────────── */}
            <AnimatePresence>
                {(viewingRecord || viewLoading) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ background: "hsl(215 35% 12% / 0.6)", backdropFilter: "blur(8px)" }}
                        onClick={() => setViewingRecord(null)}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                            style={{ border: "1px solid hsl(var(--border))" }}
                            onClick={e => e.stopPropagation()}>

                            {/* Modal header */}
                            <div className="flex items-center justify-between px-5 py-3.5"
                                style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                                <div className="flex items-center gap-2.5">
                                    <Database className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-foreground text-sm">
                                        {viewingRecord?.document?.filename || "Extraction Result"}
                                    </span>
                                    {viewingRecord?.status && <StatusChip status={viewingRecord.status} />}
                                </div>
                                <div className="flex items-center gap-2">
                                    {viewingRecord && (
                                        <button
                                            onClick={() => {
                                                const blob = new Blob([JSON.stringify(viewingRecord.result_data || {}, null, 2)], { type: "application/json" });
                                                const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                                                a.download = `result_${viewingRecord.job_id?.slice(0, 8)}.json`; a.click();
                                            }}
                                            className="btn btn-primary btn-sm">
                                            <Download className="w-3.5 h-3.5" /> Download
                                        </button>
                                    )}
                                    <button onClick={() => setViewingRecord(null)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {viewLoading ? (
                                <div className="flex items-center justify-center flex-1 py-12">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                </div>
                            ) : viewingRecord ? (
                                <div className="flex-1 overflow-auto">
                                    {/* Meta strip */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 text-center"
                                        style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                                        {[
                                            { label: "Job ID", value: viewingRecord.job_id?.slice(0, 12) + "…" },
                                            { label: "Engine", value: viewingRecord.engine_used || "—" },
                                            { label: "Fields", value: viewingRecord.field_count ?? "—" },
                                            { label: "Duration", value: viewingRecord.duration_seconds ? `${viewingRecord.duration_seconds}s` : "—" },
                                        ].map(m => (
                                            <div key={m.label} className="px-4 py-3" style={{ borderRight: "1px solid hsl(var(--border))" }}>
                                                <p className="section-label">{m.label}</p>
                                                <p className="text-sm font-mono font-medium text-foreground mt-0.5">{m.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Extracted fields */}
                                    {viewingRecord.result_data?.data && (
                                        <div className="px-5 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                                            <p className="section-label mb-3">Extracted Fields</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {Object.entries(viewingRecord.result_data.data).map(([key, val]) => (
                                                    <div key={key} className="p-3 rounded-lg"
                                                        style={{ background: "hsl(var(--muted) / 0.4)", border: "1px solid hsl(var(--border))" }}>
                                                        <p className="text-[9px] font-mono text-primary/60 uppercase tracking-wider mb-1">{key}</p>
                                                        <p className="text-sm text-foreground font-mono break-all">
                                                            {typeof val === "object" ? JSON.stringify(val) : String(val ?? "NULL")}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Raw JSON */}
                                    <details className="group">
                                        <summary className="flex items-center gap-2 px-5 py-3 cursor-pointer text-[11px] font-mono text-muted-foreground hover:text-foreground">
                                            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                                            Full JSON Response
                                        </summary>
                                        <div className="px-5 pb-5 max-h-80 overflow-auto">
                                            <pre className="text-[10px] font-mono text-foreground/60 whitespace-pre-wrap leading-relaxed p-4 rounded-lg"
                                                style={{ background: "hsl(var(--muted) / 0.5)", border: "1px solid hsl(var(--border))" }}>
                                                {JSON.stringify(viewingRecord.result_data, null, 2)}
                                            </pre>
                                        </div>
                                    </details>
                                </div>
                            ) : null}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}