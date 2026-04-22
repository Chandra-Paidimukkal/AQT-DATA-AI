// ─────────────────────────────────────────────────────────────
//  UploadExtractPage.tsx  ─ UPGRADED v3
//  • Parse ALL docs simultaneously
//  • Split-pane viewer per PDF (like image reference):
//    Left = raw document text  |  Right = structured table
//  • Markdown / JSON tab toggle on right pane
//  • Extract ALL via /run-batch
//  • Combined export (JSON + CSV)
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { useWorkflowStore, ExtractionMode, SchemaSource } from "@/stores/workflowStore";
import { HUDFrame } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileUp, Cpu, Zap, Download, CheckCircle2, Loader2,
  Database, Settings, ArrowRight, RotateCcw, AlertCircle, FileText,
  Code, List, SkipForward, ChevronDown, File, Files, FileArchive,
  X, PlayCircle, ChevronLeft, ChevronRight,
} from "lucide-react";

type ParseStatus = "idle" | "parsing" | "done" | "error";

const STEPS = ["Upload", "Schema", "Session", "Extract", "Results"];
const MODES: { id: ExtractionMode; label: string; icon: any; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Zap, desc: "Best engine automatically" },
  { id: "python", label: "Python", icon: Cpu, desc: "Rule-based extraction" },
  { id: "ai", label: "AI", icon: Database, desc: "LLM-powered extraction" },
  { id: "hybrid", label: "Hybrid", icon: Settings, desc: "AI + Python combined" },
];
const PROVIDERS = ["groq", "openai", "gemini", "landingai", "ollama"];

// ── Parse status badge ────────────────────────────────────────
function ParseBadge({ status }: { status: ParseStatus }) {
  if (status === "idle") return null;
  const cfg = {
    parsing: { label: "Parsing…", cls: "text-blue-400 bg-blue-900/20 border-blue-700/30", Icon: Loader2, spin: true },
    done: { label: "Parsed", cls: "text-emerald-400 bg-emerald-900/20 border-emerald-700/30", Icon: CheckCircle2, spin: false },
    error: { label: "Error", cls: "text-red-400 bg-red-900/20 border-red-700/30", Icon: AlertCircle, spin: false },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[9px] font-mono ${cfg.cls}`}>
      <cfg.Icon className={`w-2.5 h-2.5 ${cfg.spin ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

// ── Split-pane document viewer (matches image 2) ──────────────
function DocSplitViewer({
  doc, parsed, onClose,
}: {
  doc: { filename: string; document_id: string };
  parsed: any;
  onClose: () => void;
}) {
  const [rightTab, setRightTab] = useState<"markdown" | "json">("markdown");
  const [tableIdx, setTableIdx] = useState(0);

  const text = parsed?.document_text || "";
  const tables = parsed?.tables || [];
  const meta = parsed?.metadata || {};

  // Build flat key-value rows from first table or metadata
  const tableRows: { key: string; value: string }[] = [];
  if (tables.length > 0 && Array.isArray(tables[tableIdx])) {
    const tbl = tables[tableIdx];
    if (tbl.length >= 2 && Array.isArray(tbl[0]) && tbl[0].length === 2) {
      // 2-col key-value table
      tbl.slice(1).forEach((row: any[]) => {
        if (row[0] != null) tableRows.push({ key: String(row[0]), value: String(row[1] ?? "—") });
      });
    } else if (tbl.length >= 2) {
      // multi-col: first row = headers
      const headers = Array.isArray(tbl[0]) ? tbl[0] : [];
      tbl.slice(1, 6).forEach((row: any[], ri: number) => {
        headers.forEach((h: any, ci: number) => {
          tableRows.push({ key: `Row ${ri + 1} — ${h}`, value: String(row[ci] ?? "—") });
        });
      });
    }
  }

  const pageTxt = meta.page_count ? `${meta.page_count} page${meta.page_count !== 1 ? "s" : ""}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid hsl(220 24% 16%)", background: "hsl(220 45% 3%)" }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid hsl(220 24% 13%)", background: "hsl(220 40% 5%)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-[11px] font-mono text-foreground truncate font-medium">{doc.filename}</span>
          {pageTxt && <span className="pill-accent text-[9px] flex-shrink-0">{pageTxt}</span>}
          {tables.length > 0 && <span className="pill-info text-[9px] flex-shrink-0">{tables.length} tables</span>}
        </div>
        <button onClick={onClose}
          className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Split body ── */}
      <div className="flex" style={{ minHeight: "360px", maxHeight: "520px" }}>

        {/* LEFT — raw document text */}
        <div className="flex-1 flex flex-col overflow-hidden"
          style={{ borderRight: "1px solid hsl(220 24% 13%)", minWidth: 0 }}>
          <div className="px-4 py-2 flex items-center gap-2"
            style={{ borderBottom: "1px solid hsl(220 24% 11%)", background: "hsl(220 40% 4%)" }}>
            <span className="text-[9px] font-mono text-primary/50 uppercase tracking-widest">Document Text</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
            {text ? (
              <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap m-0"
                style={{ background: "transparent", color: "hsl(215 20% 65%)" }}>
                {text}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground/50 mt-4 text-center">No text content</p>
            )}
          </div>
        </div>

        {/* RIGHT — structured data viewer */}
        <div className="flex flex-col overflow-hidden" style={{ width: "48%", minWidth: 0 }}>
          {/* Tab bar */}
          <div className="flex items-center px-3 py-2 gap-1"
            style={{ borderBottom: "1px solid hsl(220 24% 11%)", background: "hsl(220 40% 4%)" }}>
            {(["markdown", "json"] as const).map(tab => (
              <button key={tab} onClick={() => setRightTab(tab)}
                className={`px-3 py-1 rounded text-[10px] font-mono transition-all ${rightTab === tab
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground"
                  }`}>
                {tab === "markdown" ? "Markdown" : "JSON"}
              </button>
            ))}
            {/* Table navigator */}
            {tables.length > 1 && rightTab === "markdown" && (
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setTableIdx(i => Math.max(0, i - 1))}
                  disabled={tableIdx === 0}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-[9px] font-mono text-muted-foreground">
                  {tableIdx + 1}/{tables.length}
                </span>
                <button onClick={() => setTableIdx(i => Math.min(tables.length - 1, i + 1))}
                  disabled={tableIdx === tables.length - 1}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {rightTab === "markdown" ? (
              <div>
                {tableRows.length > 0 ? (
                  <table className="w-full border-collapse text-[11px]">
                    <tbody>
                      {tableRows.map((row, i) => (
                        <tr key={i}
                          style={{ borderBottom: "1px solid hsl(220 24% 10%)" }}
                          className={i % 2 === 0 ? "" : ""}>
                          <td className="px-4 py-2 font-medium text-muted-foreground align-top"
                            style={{ width: "45%", background: "hsl(220 36% 6%)" }}>
                            {row.key}
                          </td>
                          <td className="px-4 py-2 text-foreground align-top font-mono"
                            style={{ background: "hsl(220 40% 5%)" }}>
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : tables.length > 0 ? (
                  // Multi-col table fallback
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[10px] font-mono">
                      {tables[tableIdx]?.slice(0, 10).map((row: any[], ri: number) => (
                        <tr key={ri} style={{ borderBottom: "1px solid hsl(220 24% 10%)" }}>
                          {(Array.isArray(row) ? row : []).map((cell: any, ci: number) => (
                            <td key={ci}
                              className={`px-3 py-2 ${ri === 0 ? "font-semibold text-primary/80" : "text-muted-foreground"}`}
                              style={{ background: ri === 0 ? "hsl(220 36% 7%)" : ri % 2 === 0 ? "hsl(220 40% 5%)" : "hsl(220 36% 6%)" }}>
                              {cell ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-xs text-muted-foreground/50">No structured tables found</p>
                    <p className="text-[10px] text-muted-foreground/30 mt-1">Text content shown on the left</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4" style={{ background: "hsl(220 45% 3%)" }}>
                <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap m-0"
                  style={{ background: "transparent" }}>
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function UploadExtractPage() {
  const { toast } = useToast();
  const store = useWorkflowStore();

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [creatingSession, setCreating] = useState(false);
  const [schemaJsonInput, setSchemaJson] = useState("{}");
  const [schemaJsonError, setSchemaErr] = useState("");
  const [existingSchemas, setSchemas] = useState<any[]>([]);
  const [existingSessions, setSessions] = useState<any[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [activeTab, setActiveTab] = useState<"single" | "batch" | "zip">("single");

  const [parseStatuses, setParseStatuses] = useState<Record<string, ParseStatus>>({});
  const [parseResults, setParseResults] = useState<Record<string, any>>({});
  const [openViewerId, setOpenViewerId] = useState<string | null>(null);

  const [batchExtracting, setBatchExtracting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<Record<string, any>>({});
  const [batchErrors, setBatchErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (store.currentStep === 1) {
      setLoadingSchemas(true);
      api.listSchemas().then(r => setSchemas(r.data?.items || r.data || [])).catch(() => { }).finally(() => setLoadingSchemas(false));
    }
    if (store.currentStep === 2) {
      api.listSessions().then(r => setSessions(r.data?.items || r.data || [])).catch(() => { });
    }
  }, [store.currentStep]);

  const handleUpload = async (files: FileList | null, type: "single" | "batch" | "zip") => {
    if (!files?.length) return;
    setUploading(true);
    try {
      let res: any;
      if (type === "single") res = await api.uploadSingle(files[0]);
      else if (type === "batch") res = await api.uploadBatch(Array.from(files));
      else res = await api.uploadFolderZip(files[0]);
      const raw = res.data;
      const docs = Array.isArray(raw) ? raw : raw?.documents ? raw.documents : raw?.document_id ? [raw] : [];
      if (!docs.length) throw new Error("No documents returned");
      store.addUploadedDocs(docs);
      store.setSelectedDoc(docs[0].document_id);
      const st: Record<string, ParseStatus> = {};
      docs.forEach((d: any) => { st[d.document_id] = "idle"; });
      setParseStatuses(prev => ({ ...prev, ...st }));
      toast({ title: `${docs.length} document${docs.length > 1 ? "s" : ""} uploaded` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleParseAll = async () => {
    const docs = store.uploadedDocs;
    if (!docs.length) return;
    const init: Record<string, ParseStatus> = {};
    docs.forEach(d => { init[d.document_id] = "parsing"; });
    setParseStatuses(prev => ({ ...prev, ...init }));
    setOpenViewerId(null);
    await Promise.allSettled(
      docs.map(async (doc) => {
        try {
          const res = await api.getParsedDocument(doc.document_id);
          setParseStatuses(prev => ({ ...prev, [doc.document_id]: "done" }));
          setParseResults(prev => ({ ...prev, [doc.document_id]: res.data || res }));
        } catch {
          setParseStatuses(prev => ({ ...prev, [doc.document_id]: "error" }));
        }
      })
    );
    toast({ title: "All documents parsed" });
  };

  const handleExtractAll = async () => {
    if (!store.sessionId) { toast({ title: "No session", variant: "destructive" }); return; }
    const docIds = store.uploadedDocs.map(d => d.document_id).filter(Boolean);
    if (!docIds.length) { toast({ title: "No documents", variant: "destructive" }); return; }
    setBatchExtracting(true);
    setBatchProgress({ done: 0, total: docIds.length });
    setBatchResults({}); setBatchErrors({});
    try {
      const res = await api.runBatchExtraction(store.sessionId, docIds, store.schemaId || undefined);
      const payload = res.data || res;
      const jobs: any[] = payload.jobs || [];
      const errors: any[] = payload.errors || [];
      const results: Record<string, any> = {};
      const errMap: Record<string, string> = {};
      jobs.forEach((j: any) => { results[j.document_id] = j; });
      errors.forEach((e: any) => { errMap[e.document_id] = e.error; });
      setBatchResults(results); setBatchErrors(errMap);
      setBatchProgress({ done: docIds.length, total: docIds.length });
      if (jobs[0]) store.setExtractionResult(jobs[0]);
      store.setStep(4);
      toast({ title: `Extraction complete — ${jobs.length}/${docIds.length} succeeded` });
    } catch (err: any) {
      toast({ title: "Batch failed", description: err.message, variant: "destructive" });
    } finally { setBatchExtracting(false); }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(store.uploadedDocs.map(doc => ({
      filename: doc.filename, document_id: doc.document_id,
      result: batchResults[doc.document_id] ?? null, error: batchErrors[doc.document_id] ?? null,
    })), null, 2)], { type: "application/json" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `batch_${Date.now()}.json` }).click();
  };

  const exportCSV = () => {
    const keys = new Set<string>();
    store.uploadedDocs.forEach(doc => {
      const d = batchResults[doc.document_id]?.extracted_data || batchResults[doc.document_id]?.data;
      if (d && typeof d === "object") Object.keys(d).forEach(k => keys.add(k));
    });
    const headers = ["filename", "document_id", ...Array.from(keys), "error"];
    const rows = store.uploadedDocs.map(doc => {
      const d = batchResults[doc.document_id]?.extracted_data || batchResults[doc.document_id]?.data || {};
      return headers.map(h =>
        h === "filename" ? doc.filename : h === "document_id" ? doc.document_id : h === "error"
          ? (batchErrors[doc.document_id] ?? "") : String((d as any)[h] ?? ""));
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `batch_${Date.now()}.csv` }).click();
  };

  const validateSchema = (json: string) => {
    try {
      const p = JSON.parse(json);
      if (typeof p !== "object" || p === null || Array.isArray(p)) { setSchemaErr("Schema must be a JSON object"); return false; }
      setSchemaErr(""); return true;
    } catch (e: any) { setSchemaErr(`Invalid JSON: ${e.message}`); return false; }
  };

  const handleSchemaFile = async (file: File) => {
    try {
      const text = await file.text();
      if (!validateSchema(text)) return;
      const res = await api.uploadSchema(file); const s = res.data || res;
      store.setSchemaId(s.schema_id || ""); store.setSchemaDefinition(s.schema_definition || JSON.parse(text));
      store.setSchemaName(s.name || file.name); store.setSchemaValid(true);
      toast({ title: "Schema loaded" });
    } catch (err: any) { toast({ title: "Schema upload failed", description: err.message, variant: "destructive" }); }
  };

  const handleSchemaPaste = () => {
    if (!validateSchema(schemaJsonInput)) return;
    store.setSchemaDefinition(JSON.parse(schemaJsonInput));
    store.setSchemaValid(true); store.setSchemaId(""); store.setSchemaName("Inline Schema");
    toast({ title: "Schema applied" });
  };

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const needsProvider = store.sessionMode === "ai" || store.sessionMode === "hybrid";
      const payload: any = { session_id: crypto.randomUUID(), mode: store.sessionMode, provider: needsProvider ? store.sessionProvider : "none" };
      if (needsProvider && store.providerConfig.api_key) payload.provider_config = { ...store.providerConfig };
      const res = await api.createSession(payload); const s = res.data || res;
      const sid = s.session_id || s.id || ""; if (!sid) throw new Error("No session_id returned");
      store.setSessionId(sid); store.setSessionCreated(true); toast({ title: "Session created" });
    } catch (err: any) {
      toast({ title: "Session failed", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    handleUpload(e.dataTransfer.files, e.dataTransfer.files.length > 1 ? "batch" : "single");
  }, []);

  const parsedCount = store.uploadedDocs.filter(d => parseStatuses[d.document_id] === "done").length;
  const anyParsing = store.uploadedDocs.some(d => parseStatuses[d.document_id] === "parsing");
  const allParsed = store.uploadedDocs.length > 0 && store.uploadedDocs.every(d =>
    parseStatuses[d.document_id] === "done" || parseStatuses[d.document_id] === "error");

  const canAdvance = (step: number) => {
    if (step === 0) return store.uploadedDocs.length > 0;
    if (step === 1) return store.schemaSource === "skip" || store.schemaValid;
    if (step === 2) return store.sessionCreated && !!store.sessionId;
    if (step === 3) return Object.keys(batchResults).length > 0;
    return true;
  };
  const goNext = () => { if (canAdvance(store.currentStep)) store.setStep(store.currentStep + 1); };
  const needsProvider = store.sessionMode === "ai" || store.sessionMode === "hybrid";

  const Stepper = () => (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = i < store.currentStep, active = i === store.currentStep, locked = i > store.currentStep;
        return (
          <div key={s} className="flex items-center">
            <button onClick={() => !locked && store.setStep(i)} disabled={locked}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-medium tracking-wide transition-all whitespace-nowrap
                ${active ? "text-primary" : done ? "text-emerald-400 cursor-pointer" : "text-muted-foreground/50 cursor-not-allowed"}`}
              style={active ? { background: "hsl(185 72% 44% / 0.08)", border: "1px solid hsl(185 72% 44% / 0.22)" }
                : done ? { background: "hsl(148 58% 40% / 0.06)", border: "1px solid hsl(148 58% 40% / 0.18)" }
                  : { background: "transparent", border: "1px solid transparent" }}>
              {done ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono"
                  style={{ background: active ? "hsl(185 72% 44% / 0.2)" : "hsl(220 26% 12%)" }}>{i + 1}</span>}
              {s}
            </button>
            {i < STEPS.length - 1 && (
              <div className="w-6 h-px mx-0.5"
                style={{ background: i < store.currentStep ? "hsl(148 58% 40% / 0.4)" : "hsl(220 24% 16%)" }} />
            )}
          </div>
        );
      })}
    </div>
  );

  const ContinueBtn = ({ label = "Continue", step }: { label?: string; step: number }) => (
    <div className="mt-6 flex justify-end">
      <button onClick={goNext} disabled={!canAdvance(step)} className="btn btn-primary glow-primary">
        {label} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="relative z-10 pt-[52px] min-h-screen">
      <div className="max-w-5xl mx-auto px-5 py-8">

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse-glow" />
            <span className="section-label">Agentic Extraction Pipeline</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Upload & Extract</h1>
          <p className="text-muted-foreground text-sm mt-1">End-to-end document data extraction in 5 steps</p>
          <div className="divider mt-4" />
        </div>

        <Stepper />

        <AnimatePresence mode="wait">

          {/* ══ STEP 0: UPLOAD ══════════════════════════════════ */}
          {store.currentStep === 0 && (
            <motion.div key="step-upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

              {/* Tabs */}
              <div className="mb-4 flex items-center gap-1 p-1 rounded-lg w-fit"
                style={{ background: "hsl(220 40% 7%)", border: "1px solid hsl(220 24% 13%)" }}>
                {([
                  { id: "single" as const, icon: File, label: "Single File" },
                  { id: "batch" as const, icon: Files, label: "Batch Upload" },
                  { id: "zip" as const, icon: FileArchive, label: "ZIP Folder" },
                ]).map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all
                      ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <tab.icon className="w-3.5 h-3.5" />{tab.label}
                  </button>
                ))}
              </div>

              {/* Drop zone */}
              <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
                className="rounded-xl transition-all"
                style={{ border: `2px dashed ${dragOver ? "hsl(185 72% 44% / 0.6)" : "hsl(220 24% 20%)"}`, background: dragOver ? "hsl(185 72% 44% / 0.04)" : "hsl(220 40% 6% / 0.5)", padding: "3rem 2rem" }}>
                {uploading ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm font-medium text-primary">Uploading…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-5 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: "hsl(185 72% 44% / 0.08)", border: "1px solid hsl(185 72% 44% / 0.2)" }}>
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground mb-1">Drop files here</p>
                      <p className="text-sm text-muted-foreground">or choose an upload method below</p>
                      <p className="text-xs text-muted-foreground/60 mt-1 font-mono">PDF, PNG, JPG, JPEG, TIFF</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2.5">
                      {activeTab === "single" && (
                        <label className="btn btn-primary glow-primary cursor-pointer">
                          <FileUp className="w-4 h-4" /> Choose File
                          <input type="file" className="hidden" onChange={e => handleUpload(e.target.files, "single")} />
                        </label>
                      )}
                      {activeTab === "batch" && (
                        <label className="btn btn-primary glow-primary cursor-pointer">
                          <Files className="w-4 h-4" /> Choose Files
                          <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, "batch")} />
                        </label>
                      )}
                      {activeTab === "zip" && (
                        <label className="btn btn-primary glow-primary cursor-pointer">
                          <FileArchive className="w-4 h-4" /> Choose ZIP
                          <input type="file" accept=".zip" className="hidden" onChange={e => handleUpload(e.target.files, "zip")} />
                        </label>
                      )}
                      {activeTab !== "single" && (
                        <label className="btn btn-ghost cursor-pointer">
                          <File className="w-4 h-4" /> Single File
                          <input type="file" className="hidden" onChange={e => handleUpload(e.target.files, "single")} />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Uploaded docs */}
              {store.uploadedDocs.length > 0 && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="section-label">Uploaded Documents ({store.uploadedDocs.length})</p>
                    {allParsed && (
                      <span className="text-[10px] font-mono text-emerald-400">{parsedCount}/{store.uploadedDocs.length} parsed ✓</span>
                    )}
                  </div>

                  {/* Doc cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {store.uploadedDocs.map((doc, i) => {
                      const ps = parseStatuses[doc.document_id] || "idle";
                      const isSelected = store.selectedDocId === doc.document_id;
                      const hasParsed = !!parseResults[doc.document_id];
                      return (
                        <motion.div key={i}
                          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                          onClick={() => {
                            store.setSelectedDoc(doc.document_id);
                            if (hasParsed) setOpenViewerId(prev => prev === doc.document_id ? null : doc.document_id);
                          }}
                          className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all"
                          style={{
                            background: "hsl(220 40% 7%)",
                            border: isSelected ? "1px solid hsl(185 72% 44% / 0.4)" : "1px solid hsl(220 24% 13%)",
                          }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: "hsl(185 72% 44% / 0.08)", border: "1px solid hsl(185 72% 44% / 0.14)" }}>
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{doc.filename || `Doc ${i + 1}`}</p>
                            <p className="text-[10px] font-mono text-muted-foreground truncate">{doc.document_id}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <ParseBadge status={ps} />
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Parse All button */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <button onClick={handleParseAll} disabled={anyParsing} className="btn btn-primary glow-primary">
                      {anyParsing
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Parsing {parsedCount}/{store.uploadedDocs.length}…</>
                        : <><FileText className="w-3.5 h-3.5" /> Parse All ({store.uploadedDocs.length})</>
                      }
                    </button>
                  </div>

                  {/* Progress bar */}
                  {anyParsing && (
                    <div className="space-y-1">
                      <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "hsl(220 24% 13%)" }}>
                        <motion.div className="h-full rounded-full" style={{ background: "hsl(185 72% 44%)" }}
                          animate={{ width: `${(parsedCount / store.uploadedDocs.length) * 100}%` }} transition={{ duration: 0.3 }} />
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground">{parsedCount}/{store.uploadedDocs.length} parsed</p>
                    </div>
                  )}

                  {/* ══ SPLIT VIEWER — one per parsed doc ══ */}
                  <AnimatePresence>
                    {store.uploadedDocs.map(doc => {
                      const isOpen = openViewerId === doc.document_id;
                      const parsed = parseResults[doc.document_id];
                      if (!isOpen || !parsed) return null;
                      return (
                        <motion.div key={`viewer-${doc.document_id}`}
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                          <DocSplitViewer doc={doc} parsed={parsed} onClose={() => setOpenViewerId(null)} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  <ContinueBtn label="Continue to Schema" step={0} />
                </div>
              )}
            </motion.div>
          )}

          {/* ══ STEP 1: SCHEMA ══════════════════════════════════ */}
          {store.currentStep === 1 && (
            <motion.div key="step-schema" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <HUDFrame label="Schema Configuration">
                <div>
                  <p className="text-sm font-medium text-foreground mb-4">Choose how to provide your extraction schema</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                    {([
                      { id: "upload" as SchemaSource, label: "Upload JSON", icon: FileUp },
                      { id: "paste" as SchemaSource, label: "Paste JSON", icon: Code },
                      { id: "existing" as SchemaSource, label: "Saved Schemas", icon: List },
                      { id: "skip" as SchemaSource, label: "Skip / Auto", icon: SkipForward },
                    ]).map(opt => {
                      const active = store.schemaSource === opt.id;
                      return (
                        <button key={opt.id}
                          onClick={() => { store.setSchemaSource(opt.id); if (opt.id === "skip") { store.setSchemaValid(false); store.setSchemaId(""); store.setSchemaDefinition(null); } }}
                          className="flex flex-col items-center gap-2 p-3.5 rounded-xl text-center transition-all"
                          style={{ background: active ? "hsl(185 72% 44% / 0.08)" : "hsl(220 26% 9%)", border: `1px solid ${active ? "hsl(185 72% 44% / 0.28)" : "hsl(220 24% 14%)"}` }}>
                          <opt.icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {store.schemaSource === "upload" && (
                    <label className="block w-full rounded-xl p-6 text-center cursor-pointer transition-all"
                      style={{ background: "hsl(220 26% 9%)", border: "2px dashed hsl(220 24% 18%)" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "hsl(185 72% 44% / 0.35)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(220 24% 18%)")}>
                      <FileUp className="w-8 h-8 text-primary/50 mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground mb-1">Drop your .json schema file</p>
                      <p className="text-xs text-muted-foreground">or click to browse</p>
                      <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && handleSchemaFile(e.target.files[0])} />
                    </label>
                  )}
                  {store.schemaSource === "paste" && (
                    <div className="space-y-3">
                      <textarea value={schemaJsonInput} onChange={e => { setSchemaJson(e.target.value); setSchemaErr(""); }}
                        rows={10} placeholder={'{\n  "fields": [\n    { "name": "model_number", "type": "string" }\n  ]\n}'}
                        className="input-base resize-none leading-relaxed" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px" }} />
                      {schemaJsonError && <div className="flex items-center gap-2 text-xs text-red-400"><AlertCircle className="w-3.5 h-3.5" /> {schemaJsonError}</div>}
                      <div className="flex items-center gap-2">
                        <button onClick={handleSchemaPaste} className="btn btn-primary glow-primary"><CheckCircle2 className="w-4 h-4" /> Validate & Apply</button>
                        <button onClick={() => { try { setSchemaJson(JSON.stringify(JSON.parse(schemaJsonInput), null, 2)); } catch { } }} className="btn btn-ghost">Format JSON</button>
                      </div>
                    </div>
                  )}
                  {store.schemaSource === "existing" && (
                    <div className="space-y-2">
                      {loadingSchemas ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                      ) : existingSchemas.length === 0 ? (
                        <div className="text-center py-8"><Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No saved schemas</p></div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                          {existingSchemas.map((s: any) => {
                            const active = store.schemaId === s.schema_id;
                            return (
                              <button key={s.schema_id}
                                onClick={() => { store.setSchemaId(s.schema_id); store.setSchemaDefinition(s.schema_definition); store.setSchemaName(s.name); store.setSchemaValid(true); }}
                                className="p-3 rounded-lg text-left transition-all"
                                style={{ background: active ? "hsl(185 72% 44% / 0.07)" : "hsl(220 26% 9%)", border: `1px solid ${active ? "hsl(185 72% 44% / 0.3)" : "hsl(220 24% 14%)"}` }}>
                                <div className="flex items-center gap-2">
                                  <FileText className={`w-4 h-4 flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                                  {active && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto" />}
                                </div>
                                <p className="text-[10px] font-mono text-muted-foreground truncate mt-1 pl-6">{s.schema_id}</p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {store.schemaSource === "skip" && (
                    <div className="p-4 rounded-xl text-center" style={{ background: "hsl(220 26% 9%)", border: "1px solid hsl(220 24% 14%)" }}>
                      <SkipForward className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No schema — automatic extraction will be attempted</p>
                    </div>
                  )}
                  {store.schemaValid && (
                    <div className="mt-4 flex items-center gap-2.5 p-3 rounded-lg" style={{ background: "hsl(148 58% 40% / 0.06)", border: "1px solid hsl(148 58% 40% / 0.18)" }}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs text-emerald-400 font-medium">Active: </span>
                        <span className="text-xs text-emerald-400/80 font-mono">{store.schemaName}</span>
                        {store.schemaId && <span className="text-[10px] text-muted-foreground ml-2 font-mono">({store.schemaId.slice(0, 8)}…)</span>}
                      </div>
                    </div>
                  )}
                </div>
              </HUDFrame>
              <ContinueBtn label="Continue to Session" step={1} />
            </motion.div>
          )}

          {/* ══ STEP 2: SESSION ══════════════════════════════════ */}
          {store.currentStep === 2 && (
            <motion.div key="step-session" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <HUDFrame label="Session Configuration">
                {store.sessionCreated ? (
                  <div className="p-4 rounded-xl" style={{ background: "hsl(148 58% 40% / 0.05)", border: "1px solid hsl(148 58% 40% / 0.18)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-400" /><span className="font-semibold text-emerald-400">Session Active</span></div>
                      <button onClick={() => { store.setSessionCreated(false); store.setSessionId(""); }}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono">
                        <RotateCcw className="w-3 h-3" /> Change
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[{ label: "Session ID", value: store.sessionId.slice(0, 16) + "…" }, { label: "Mode", value: store.sessionMode }, { label: "Provider", value: store.sessionProvider }].map(item => (
                        <div key={item.label} className="p-2.5 rounded-lg" style={{ background: "hsl(220 40% 7%)", border: "1px solid hsl(220 24% 13%)" }}>
                          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{item.label}</p>
                          <p className="text-xs font-mono text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {existingSessions.length > 0 && (
                      <div>
                        <p className="section-label mb-2">Recent Sessions</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto mb-4">
                          {existingSessions.slice(0, 6).map((s: any) => (
                            <button key={s.session_id}
                              onClick={() => { store.setSessionId(s.session_id); store.setSessionMode(s.mode || "auto"); store.setSessionProvider(s.provider || "none"); store.setSessionCreated(true); toast({ title: "Session selected" }); }}
                              className="p-3 rounded-lg text-left transition-all hover:border-primary/20" style={{ background: "hsl(220 26% 9%)", border: "1px solid hsl(220 24% 14%)" }}>
                              <p className="text-[10px] font-mono text-foreground truncate">{s.session_id}</p>
                              <div className="flex gap-1.5 mt-1.5"><span className="pill-info text-[9px]">{s.mode}</span><span className="pill-accent text-[9px]">{s.provider}</span></div>
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mb-1">
                          <div className="flex-1 h-px" style={{ background: "hsl(220 24% 13%)" }} />
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">or create new</span>
                          <div className="flex-1 h-px" style={{ background: "hsl(220 24% 13%)" }} />
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="section-label mb-2.5">Extraction Mode</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {MODES.map(m => {
                          const active = store.sessionMode === m.id;
                          return (
                            <button key={m.id} onClick={() => store.setSessionMode(m.id)}
                              className="p-4 rounded-xl flex flex-col items-center gap-2 text-center transition-all"
                              style={{ background: active ? "hsl(185 72% 44% / 0.08)" : "hsl(220 26% 9%)", border: `1px solid ${active ? "hsl(185 72% 44% / 0.28)" : "hsl(220 24% 14%)"}` }}>
                              <m.icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                              <span className={`text-[12px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>{m.label}</span>
                              <span className="text-[10px] text-muted-foreground leading-tight">{m.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {needsProvider && (
                      <div className="space-y-4">
                        <div>
                          <p className="section-label mb-2.5">AI Provider</p>
                          <div className="flex flex-wrap gap-2">
                            {PROVIDERS.map(p => {
                              const active = store.sessionProvider === p;
                              return (
                                <button key={p} onClick={() => store.setSessionProvider(p)}
                                  className="px-4 py-1.5 rounded-lg text-xs font-mono tracking-wider uppercase transition-all"
                                  style={{ background: active ? "hsl(248 55% 55% / 0.1)" : "hsl(220 26% 9%)", border: `1px solid ${active ? "hsl(248 55% 55% / 0.35)" : "hsl(220 24% 14%)"}`, color: active ? "hsl(248 55% 75%)" : "hsl(215 12% 42%)" }}>
                                  {p}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl space-y-3" style={{ background: "hsl(220 26% 8%)", border: "1px solid hsl(220 24% 13%)" }}>
                          <p className="section-label">Provider Config</p>
                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1.5">API Key</label>
                            <input type="password" value={store.providerConfig.api_key || ""} onChange={e => store.setProviderConfig({ ...store.providerConfig, api_key: e.target.value })} placeholder="Enter API key…" className="input-base" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] text-muted-foreground block mb-1.5">Model</label>
                              <input value={store.providerConfig.model || ""} onChange={e => store.setProviderConfig({ ...store.providerConfig, model: e.target.value })} placeholder="e.g. gpt-4o" className="input-base" />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground block mb-1.5">Base URL</label>
                              <input value={store.providerConfig.base_url || ""} onChange={e => store.setProviderConfig({ ...store.providerConfig, base_url: e.target.value })} placeholder="Custom endpoint" className="input-base" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <button onClick={handleCreateSession} disabled={creatingSession} className="w-full btn btn-primary glow-primary justify-center py-3">
                      {creatingSession ? <><Loader2 className="w-4 h-4 animate-spin" /> Initializing…</> : <><Zap className="w-4 h-4" /> Initialize Session</>}
                    </button>
                  </div>
                )}
              </HUDFrame>
              <ContinueBtn label="Continue to Extraction" step={2} />
            </motion.div>
          )}

          {/* ══ STEP 3: EXTRACT ALL ══════════════════════════════ */}
          {store.currentStep === 3 && (
            <motion.div key="step-extract" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <HUDFrame label="Batch Extraction">
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    All <span className="text-foreground font-semibold">{store.uploadedDocs.length}</span> document{store.uploadedDocs.length !== 1 ? "s" : ""} extracted simultaneously in one request.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Documents", value: `${store.uploadedDocs.length} files`, icon: Files },
                      { label: "Schema", value: store.schemaName || "Auto (none)", icon: Database },
                      { label: "Session", value: `${store.sessionMode} / ${store.sessionProvider}`, icon: Settings, sub: store.sessionId.slice(0, 14) + "…" },
                    ].map(item => (
                      <div key={item.label} className="p-3.5 rounded-xl" style={{ background: "hsl(220 26% 8%)", border: "1px solid hsl(220 24% 13%)" }}>
                        <div className="flex items-center gap-2 mb-2"><item.icon className="w-3.5 h-3.5 text-primary/60" /><span className="section-label">{item.label}</span></div>
                        <p className="text-sm font-medium text-foreground truncate">{item.value}</p>
                        {"sub" in item && <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{item.sub}</p>}
                      </div>
                    ))}
                  </div>
                  {batchExtracting && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground"><span>Extracting…</span><span>{batchProgress.done}/{batchProgress.total}</span></div>
                      <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "hsl(220 24% 13%)" }}>
                        <motion.div className="h-full rounded-full" style={{ background: "hsl(185 72% 44%)" }}
                          animate={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }} transition={{ duration: 0.3 }} />
                      </div>
                    </div>
                  )}
                  <button onClick={handleExtractAll} disabled={batchExtracting} className="w-full btn btn-primary glow-primary justify-center py-3.5 text-base">
                    {batchExtracting
                      ? <><Loader2 className="w-5 h-5 animate-spin" /> Extracting {batchProgress.done}/{batchProgress.total}…</>
                      : <><PlayCircle className="w-5 h-5" /> Extract All ({store.uploadedDocs.length}) Documents</>
                    }
                  </button>
                </div>
              </HUDFrame>
            </motion.div>
          )}

          {/* ══ STEP 4: RESULTS ══════════════════════════════════ */}
          {store.currentStep === 4 && (
            <motion.div key="step-results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <HUDFrame label="Batch Results">
                <div className="space-y-5">
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "hsl(148 58% 40% / 0.06)", border: "1px solid hsl(148 58% 40% / 0.18)" }}>
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-400">{Object.keys(batchResults).length}/{store.uploadedDocs.length} extracted</p>
                        {Object.keys(batchErrors).length > 0 && <p className="text-[10px] font-mono text-red-400">{Object.keys(batchErrors).length} failed</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={exportJSON} className="btn btn-primary btn-sm"><Download className="w-3.5 h-3.5" /> JSON</button>
                      <button onClick={exportCSV} className="btn btn-ghost btn-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
                    </div>
                  </div>

                  {/* Per-doc result cards — split viewer style */}
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {store.uploadedDocs.map(doc => {
                      const r = batchResults[doc.document_id];
                      const err = batchErrors[doc.document_id];
                      const data = r?.extracted_data || r?.data;
                      const entries = data && typeof data === "object" ? Object.entries(data) : [];
                      return (
                        <details key={doc.document_id} className="group rounded-xl overflow-hidden"
                          style={{ background: "hsl(220 26% 8%)", border: `1px solid ${err ? "hsl(0 60% 40% / 0.3)" : r ? "hsl(148 58% 40% / 0.2)" : "hsl(220 24% 13%)"}` }}>
                          <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none">
                            {err ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                              : r ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                : <Loader2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{doc.filename}</p>
                              <p className="text-[10px] font-mono text-muted-foreground truncate">{doc.document_id}</p>
                            </div>
                            {entries.length > 0 && <span className="text-[10px] font-mono text-primary/70 mr-2 flex-shrink-0">{entries.length} fields</span>}
                            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180 flex-shrink-0" />
                          </summary>

                          <div style={{ borderTop: "1px solid hsl(220 24% 13%)", background: "hsl(220 40% 5%)" }}>
                            {err ? (
                              <p className="px-4 py-3 text-xs text-red-400 font-mono">{err}</p>
                            ) : entries.length > 0 ? (
                              /* Split table — matches image 2 style */
                              <table className="w-full border-collapse text-[11px]">
                                <tbody>
                                  {entries.map(([key, val], i) => (
                                    <tr key={key} style={{ borderBottom: "1px solid hsl(220 24% 10%)" }}>
                                      <td className="px-4 py-2.5 font-medium text-muted-foreground align-top"
                                        style={{ width: "42%", background: i % 2 === 0 ? "hsl(220 36% 6%)" : "hsl(220 34% 7%)" }}>
                                        {key}
                                      </td>
                                      <td className="px-4 py-2.5 text-foreground align-top font-mono text-[11px]"
                                        style={{ background: i % 2 === 0 ? "hsl(220 40% 5%)" : "hsl(220 38% 6%)" }}>
                                        {typeof val === "object" ? JSON.stringify(val) : String(val ?? "—")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <pre className="px-4 py-3 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap m-0"
                                style={{ background: "transparent" }}>
                                {JSON.stringify(r, null, 2)}
                              </pre>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>

                  <button onClick={() => { store.resetWorkflow(); setBatchResults({}); setBatchErrors({}); setParseStatuses({}); setParseResults({}); }} className="btn btn-ghost">
                    <RotateCcw className="w-4 h-4" /> Start New Extraction
                  </button>
                </div>
              </HUDFrame>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}