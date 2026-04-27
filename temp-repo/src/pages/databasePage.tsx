import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
    Database, RefreshCw, ChevronRight, ChevronDown,
    CheckCircle2, XCircle, Clock, Loader2, RotateCcw,
    Download, Trash2, FileText, X, Eye, AlertCircle,
    Code2, Filter,
} from "lucide-react";
import SchemaTable, { normalizeRowsToSchema } from "./_schemaTable";

// ── Types ─────────────────────────────────────────────────────────────────────
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
    schema_fields?: string[];
    extracted_rows: Record<string, any>[];
    extracted_raw: any;
    field_count: number;
    row_count: number;
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
}

interface Stats {
    total: number;
    completed: number;
    partial: number;
    failed: number;
    running: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function dedupeFields(fields: string[] = []): string[] {
    return Array.from(new Set(fields.map((f) => String(f || "").trim()).filter(Boolean)));
}

function inferColumnsFromRows(rows: Record<string, any>[] = []): string[] {
    return Array.from(
        new Set(
            rows.flatMap((r) => Object.keys(r || {})).filter((k) => !k.startsWith("_"))
        )
    );
}

function getSchemaColumns(job: JobDetail): string[] {
    const schemaFields = dedupeFields(job.schema_fields || []);
    if (schemaFields.length > 0) return schemaFields;
    return inferColumnsFromRows(job.extracted_rows || []);
}

function escapeCsv(v: any): string {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
    completed: { icon: CheckCircle2, label: "Completed", fg: "#10b981", bg: "rgba(16,185,129,0.10)", bd: "rgba(16,185,129,0.22)" },
    partial: { icon: AlertCircle, label: "Partial", fg: "#f59e0b", bg: "rgba(245,158,11,0.10)", bd: "rgba(245,158,11,0.22)" },
    failed: { icon: XCircle, label: "Failed", fg: "#ef4444", bg: "rgba(239,68,68,0.10)", bd: "rgba(239,68,68,0.22)" },
    running: { icon: Loader2, label: "Running", fg: "#38bdf8", bg: "rgba(56,189,248,0.10)", bd: "rgba(56,189,248,0.22)" },
    pending: { icon: Clock, label: "Pending", fg: "#94a3b8", bg: "rgba(148,163,184,0.10)", bd: "rgba(148,163,184,0.22)" },
};

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
    const Icon = c.icon;
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ color: c.fg, background: c.bg, border: `1px solid ${c.bd}` }}
        >
            <Icon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} style={{ color: c.fg }} />
            {c.label}
        </span>
    );
}

// ── Document result viewer ────────────────────────────────────────────────────
function DocResultPanel({
    job,
    onClose,
}: {
    job: JobDetail;
    onClose: () => void;
}) {
    const [tab, setTab] = useState<"table" | "json">("table");

    const schemaColumns = useMemo(() => getSchemaColumns(job), [job]);
    const normalizedRows = useMemo(
        () => normalizeRowsToSchema(job.extracted_rows || [], schemaColumns, job.filename),
        [job.extracted_rows, schemaColumns, job.filename]
    );

    const downloadCSV = () => {
        if (!normalizedRows.length) return;
        const cols = schemaColumns.length ? schemaColumns : inferColumnsFromRows(normalizedRows);
        const lines = [
            cols.join(","),
            ...normalizedRows.map((row) => cols.map((c) => escapeCsv(row[c])).join(",")),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${job.filename.replace(/\s/g, "_")}_result.csv`;
        a.click();
    };

    const downloadJSON = () => {
        const blob = new Blob([JSON.stringify(job.extracted_raw, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${job.filename.replace(/\s/g, "_")}_result.json`;
        a.click();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid #1e3a5f", background: "#071a2e" }}
        >
            <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: "1px solid #1e3a5f", background: "#0a2038" }}
            >
                <div className="flex items-center gap-2.5">
                    <FileText className="w-3.5 h-3.5" style={{ color: "#38bdf8" }} />
                    <span className="text-xs font-medium truncate max-w-[280px]" style={{ color: "#e2e8f0" }}>
                        {job.filename}
                    </span>
                    <StatusBadge status={job.status} />
                    {job.row_count > 0 && (
                        <span
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}
                        >
                            {job.row_count} {job.row_count === 1 ? "record" : "records"} · {schemaColumns.length || job.field_count} fields
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid #1e3a5f" }}>
                        {([["table", FileText, "Table"], ["json", Code2, "JSON"]] as const).map(([t, Icon, lbl]) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono transition-all"
                                style={{
                                    background: tab === t ? "#38bdf8" : "transparent",
                                    color: tab === t ? "#000" : "#64748b",
                                }}
                            >
                                <Icon className="w-3 h-3" /> {lbl}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={downloadCSV}
                        title="Download CSV"
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded transition-colors"
                        style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}
                    >
                        <Download className="w-3 h-3" /> CSV
                    </button>

                    <button
                        onClick={downloadJSON}
                        title="Download JSON"
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded transition-colors"
                        style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}
                    >
                        <Download className="w-3 h-3" /> JSON
                    </button>

                    <button
                        onClick={onClose}
                        className="p-1 rounded transition-colors hover:bg-white/5"
                        style={{ color: "#64748b" }}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {job.status === "failed" && job.error_message && (
                <div
                    className="px-4 py-3 text-xs font-mono"
                    style={{ background: "rgba(239,68,68,0.07)", borderBottom: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
                >
                    <span className="font-semibold">Error: </span>
                    {job.error_message}
                </div>
            )}

            <div className="p-4">
                {tab === "table" ? (
                    <SchemaTable rows={normalizedRows} schemaFields={schemaColumns} />
                ) : (
                    <pre
                        className="text-[10px] font-mono overflow-auto max-h-80 leading-relaxed"
                        style={{ color: "#94a3b8", whiteSpace: "pre-wrap" }}
                    >
                        {JSON.stringify(job.extracted_raw, null, 2)}
                    </pre>
                )}
            </div>

            <div
                className="px-4 py-2 flex items-center gap-4 text-[9px] font-mono"
                style={{ borderTop: "1px solid #1e3a5f", color: "#334155" }}
            >
                <span>Started: {job.started_at || "—"}</span>
                <span>Finished: {job.completed_at || "—"}</span>
                {job.duration_seconds && <span>Duration: {job.duration_seconds}s</span>}
                {job.engine_used && <span>Engine: {job.engine_used}</span>}
            </div>
        </motion.div>
    );
}

// ── Batch Row ─────────────────────────────────────────────────────────────────
function BatchRow({
    batch,
    onDelete,
    onRerun,
}: {
    batch: Batch;
    onDelete: (id: string) => void;
    onRerun: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState<Batch | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
    const [rerunning, setRerunning] = useState(false);

    const loadDetail = async () => {
        if (detail) {
            setExpanded(!expanded);
            return;
        }
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/v1/database/${batch.batch_id}`);
            const json = await res.json();
            setDetail(json.data);
            setExpanded(true);
        } catch {
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleRerun = async () => {
        setRerunning(true);
        await onRerun(batch.batch_id);
        setRerunning(false);
    };

    const downloadAllCSV = () => {
        if (!detail?.jobs?.length) return;

        const allSchemaFields = Array.from(
            new Set(detail.jobs.flatMap((j) => getSchemaColumns(j)))
        );

        const allRows = detail.jobs.flatMap((j) =>
            normalizeRowsToSchema(j.extracted_rows || [], allSchemaFields, j.filename)
        );

        if (!allRows.length) return;

        const cols = ["_document", ...allSchemaFields];
        const lines = [
            cols.join(","),
            ...allRows.map((row) => cols.map((c) => escapeCsv(row[c])).join(",")),
        ];

        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `batch_${batch.batch_id.slice(0, 8)}_all.csv`;
        a.click();
    };

    return (
        <div className="rounded-xl overflow-hidden transition-all" style={{ border: "1px solid #1e3a5f", background: "#071a2e" }}>
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={loadDetail}
            >
                <span style={{ color: "#334155", flexShrink: 0 }}>
                    {loadingDetail ? (
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#38bdf8" }} />
                    ) : expanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                </span>

                <StatusBadge status={batch.status} />

                <div className="w-32 flex-shrink-0">
                    <p className="text-[11px] font-mono" style={{ color: "#e2e8f0" }}>
                        {batch.created_at?.slice(0, 10)}
                    </p>
                    <p className="text-[9px] font-mono" style={{ color: "#475569" }}>
                        {batch.created_at?.slice(11)}
                    </p>
                </div>

                <div className="flex-shrink-0 text-center w-20">
                    <p className="text-sm font-bold" style={{ color: "#38bdf8" }}>
                        {batch.document_count}
                    </p>
                    <p className="text-[9px] font-mono uppercase" style={{ color: "#475569" }}>
                        docs
                    </p>
                </div>

                <div className="min-w-0 w-36">
                    <p className="text-[9px] font-mono uppercase" style={{ color: "#334155" }}>
                        Schema
                    </p>
                    <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
                        {batch.schema_name || <span style={{ color: "#334155", fontStyle: "italic" }}>none</span>}
                    </p>
                </div>

                <div className="hidden md:block min-w-0 w-32">
                    <p className="text-[9px] font-mono uppercase" style={{ color: "#334155" }}>
                        Session
                    </p>
                    <p className="text-xs truncate capitalize" style={{ color: "#94a3b8" }}>
                        {batch.session.mode} · {batch.session.provider}
                    </p>
                </div>

                <div className="hidden lg:flex items-center gap-2 flex-1">
                    {batch.completed_count > 0 && (
                        <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded"
                            style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}
                        >
                            {batch.completed_count} ✓
                        </span>
                    )}
                    {batch.failed_count > 0 && (
                        <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                            {batch.failed_count} ✗
                        </span>
                    )}
                    {batch.duration_seconds && (
                        <span className="text-[9px] font-mono" style={{ color: "#334155" }}>
                            {batch.duration_seconds}s
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {detail && (
                        <button
                            onClick={downloadAllCSV}
                            title="Download all as CSV"
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: "#475569" }}
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={handleRerun}
                        disabled={rerunning || batch.status === "running"}
                        title="Re-run"
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                        style={{ color: "#475569" }}
                    >
                        {rerunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => onDelete(batch.batch_id)}
                        title="Delete"
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                        style={{ color: "#475569" }}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && detail && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ borderTop: "1px solid #1e3a5f" }}
                    >
                        <div className="px-4 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {[
                                    { label: "Batch ID", value: detail.batch_id.slice(0, 16) + "…" },
                                    { label: "Session ID", value: detail.session.session_id.slice(0, 16) + "…" },
                                    { label: "Started", value: detail.started_at || "—" },
                                    { label: "Completed", value: detail.completed_at || "—" },
                                ].map((m) => (
                                    <div
                                        key={m.label}
                                        className="px-3 py-2 rounded-lg"
                                        style={{ background: "#0a2038", border: "1px solid #1e3a5f" }}
                                    >
                                        <p className="text-[9px] font-mono uppercase mb-0.5" style={{ color: "#334155" }}>
                                            {m.label}
                                        </p>
                                        <p className="text-[10px] font-mono truncate" style={{ color: "#94a3b8" }}>
                                            {m.value}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="mb-4">
                                <p
                                    className="text-[10px] font-mono uppercase mb-2"
                                    style={{ color: "#38bdf8", letterSpacing: "0.15em" }}
                                >
                                    Documents ({detail.jobs?.length || 0})
                                </p>

                                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #1e3a5f" }}>
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr style={{ background: "#0c2340" }}>
                                                {["#", "Document", "Status", "Records", "Fields", "Duration", "Action"].map((h) => (
                                                    <th
                                                        key={h}
                                                        className="px-3 py-2 text-left font-mono font-semibold"
                                                        style={{ color: "#38bdf8", borderBottom: "1px solid #1e3a5f" }}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {(detail.jobs || []).map((job, i) => {
                                                const isSelected = selectedJob?.job_id === job.job_id;
                                                const schemaColumns = getSchemaColumns(job);

                                                return (
                                                    <tr
                                                        key={job.job_id}
                                                        style={{
                                                            background: isSelected ? "rgba(56,189,248,0.06)" : i % 2 === 0 ? "#071a2e" : "#0a2038",
                                                            borderLeft: isSelected ? "2px solid #38bdf8" : "2px solid transparent",
                                                        }}
                                                    >
                                                        <td
                                                            className="px-3 py-2 font-mono"
                                                            style={{ color: "#475569", borderBottom: "1px solid #1e3a5f" }}
                                                        >
                                                            {i + 1}
                                                        </td>
                                                        <td
                                                            className="px-3 py-2 max-w-[200px]"
                                                            style={{ borderBottom: "1px solid #1e3a5f" }}
                                                        >
                                                            <p className="text-xs font-medium truncate" style={{ color: "#e2e8f0" }} title={job.filename}>
                                                                {job.filename}
                                                            </p>
                                                            <p className="text-[9px] font-mono" style={{ color: "#334155" }}>
                                                                {job.job_id.slice(0, 10)}…
                                                            </p>
                                                        </td>
                                                        <td className="px-3 py-2" style={{ borderBottom: "1px solid #1e3a5f" }}>
                                                            <StatusBadge status={job.status} />
                                                        </td>
                                                        <td
                                                            className="px-3 py-2 font-mono text-center"
                                                            style={{ color: "#94a3b8", borderBottom: "1px solid #1e3a5f" }}
                                                        >
                                                            {job.row_count || "—"}
                                                        </td>
                                                        <td
                                                            className="px-3 py-2 font-mono text-center"
                                                            style={{ color: "#94a3b8", borderBottom: "1px solid #1e3a5f" }}
                                                        >
                                                            {schemaColumns.length || job.field_count || "—"}
                                                        </td>
                                                        <td
                                                            className="px-3 py-2 font-mono"
                                                            style={{ color: "#475569", borderBottom: "1px solid #1e3a5f" }}
                                                        >
                                                            {job.duration_seconds ? `${job.duration_seconds}s` : "—"}
                                                        </td>
                                                        <td className="px-3 py-2" style={{ borderBottom: "1px solid #1e3a5f" }}>
                                                            <button
                                                                onClick={() => setSelectedJob(isSelected ? null : job)}
                                                                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono transition-all"
                                                                style={
                                                                    isSelected
                                                                        ? { background: "#38bdf8", color: "#000" }
                                                                        : { background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }
                                                                }
                                                            >
                                                                <Eye className="w-3 h-3" />
                                                                {isSelected ? "Hide" : "View"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <AnimatePresence>
                                {selectedJob && (
                                    <DocResultPanel
                                        key={selectedJob.job_id}
                                        job={selectedJob}
                                        onClose={() => setSelectedJob(null)}
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

// ── Main Page ─────────────────────────────────────────────────────────────────
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
        } finally {
            setLoading(false);
        }
    }, [filter, page, toast]);

    useEffect(() => {
        fetchBatches();
    }, [fetchBatches]);

    useEffect(() => {
        if (!batches.some((b) => b.status === "running")) return;
        const id = setInterval(fetchBatches, 3000);
        return () => clearInterval(id);
    }, [batches, fetchBatches]);

    const deleteBatch = async (batchId: string) => {
        if (!confirm("Delete this extraction record and all its results?")) return;
        try {
            await fetch(`/api/v1/database/${batchId}`, { method: "DELETE" });
            setBatches((prev) => prev.filter((b) => b.batch_id !== batchId));
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
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: "#38bdf8" }} />
                        <span className="text-[10px] uppercase tracking-[0.22em] font-mono" style={{ color: "#38bdf8" }}>
                            Extraction Records
                        </span>
                    </div>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h1
                                className="text-3xl font-display font-bold"
                                style={{
                                    background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}
                            >
                                Database
                            </h1>
                            <p className="text-sm mt-1" style={{ color: "#475569" }}>
                                One record per extraction run — all documents, results, and history
                            </p>
                        </div>

                        <button
                            onClick={fetchBatches}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}
                        >
                            <RefreshCw className="w-4 h-4" /> Refresh
                        </button>
                    </div>

                    <div
                        className="mt-4 h-px"
                        style={{ background: "linear-gradient(90deg, transparent, #1e3a5f, rgba(56,189,248,0.3), #1e3a5f, transparent)" }}
                    />
                </motion.div>

                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                        {[
                            { label: "Total Runs", val: stats.total, color: "#e2e8f0" },
                            { label: "Completed", val: stats.completed, color: "#10b981" },
                            { label: "Partial", val: stats.partial, color: "#f59e0b" },
                            { label: "Failed", val: stats.failed, color: "#ef4444" },
                            { label: "Running", val: stats.running, color: "#38bdf8" },
                        ].map((s) => (
                            <div
                                key={s.label}
                                className="rounded-xl p-4 text-center"
                                style={{ background: "#071a2e", border: "1px solid #1e3a5f" }}
                            >
                                <p className="text-2xl font-display font-bold" style={{ color: s.color }}>
                                    {s.val}
                                </p>
                                <p className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: "#334155" }}>
                                    {s.label}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2 mb-5 flex-wrap">
                    <Filter className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#475569" }} />
                    {["all", "completed", "partial", "failed", "running"].map((f) => (
                        <button
                            key={f}
                            onClick={() => {
                                setFilter(f);
                                setPage(1);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                            style={
                                filter === f
                                    ? { background: "#38bdf8", color: "#000" }
                                    : { background: "rgba(56,189,248,0.06)", color: "#475569", border: "1px solid #1e3a5f" }
                            }
                        >
                            {f}
                        </button>
                    ))}
                    <span className="ml-auto text-[10px] font-mono" style={{ color: "#334155" }}>
                        {total} {total === 1 ? "record" : "records"}
                    </span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#38bdf8" }} />
                    </div>
                ) : batches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <Database className="w-14 h-14 mb-4" style={{ color: "rgba(56,189,248,0.2)" }} />
                        <p className="text-base font-semibold" style={{ color: "#e2e8f0" }}>
                            No extraction records yet
                        </p>
                        <p className="text-sm mt-1" style={{ color: "#475569" }}>
                            Run an extraction to see records here
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {batches.map((batch, idx) => (
                            <motion.div
                                key={batch.batch_id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                            >
                                <BatchRow batch={batch} onDelete={deleteBatch} onRerun={rerunBatch} />
                            </motion.div>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
                            style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}
                        >
                            ← Prev
                        </button>

                        <span className="text-xs font-mono" style={{ color: "#475569" }}>
                            Page {page} of {totalPages}
                        </span>

                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
                            style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}