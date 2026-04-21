// ─────────────────────────────────────────────────────────────
//  UploadExtractPage.tsx  — upgraded
//  Key change: Parse ALL + Extract ALL docs simultaneously,
//  then export a combined JSON / CSV of every result.
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { useWorkflowStore, ExtractionMode, SchemaSource } from "@/stores/workflowStore";
import { HUDFrame, GlassCard } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileUp, FolderArchive, FileSearch, Cpu, Zap, Download,
  CheckCircle2, Loader2, Eye, EyeOff, Database, Settings, ArrowRight,
  RotateCcw, AlertCircle, FileText, Code, List, SkipForward,
  ChevronDown, File, Files, FileArchive, X, PlayCircle,
} from "lucide-react";

const STEPS = ["Upload", "Schema", "Session", "Extract", "Results"];

const MODES: { id: ExtractionMode; label: string; icon: any; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Zap, desc: "Best engine selected automatically" },
  { id: "python", label: "Python", icon: Cpu, desc: "Rule-based Python extraction" },
  { id: "ai", label: "AI", icon: Database, desc: "LLM-powered field extraction" },
  { id: "hybrid", label: "Hybrid", icon: Settings, desc: "AI + Python combined" },
];

const PROVIDERS = ["groq", "openai", "gemini", "landingai", "ollama"];

// ── Status badge pill ─────────────────────────────────────────
function ParsePill({ status }: { status?: string }) {
  if (!status || status === "idle") return null;
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    parsing: { label: "Parsing…", cls: "text-blue-400 bg-blue-900/30 border-blue-700/40", icon: Loader2 },
    done: { label: "Parsed", cls: "text-emerald-400 bg-emerald-900/30 border-emerald-700/40", icon: CheckCircle2 },
    error: { label: "Error", cls: "text-red-400 bg-red-900/30 border-red-700/40", icon: AlertCircle },
  };
  const { label, cls, icon: Icon } = map[status] ?? map.error;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono ${cls}`}>
      <Icon className={`w-2.5 h-2.5 ${status === "parsing" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

export default function UploadExtractPage() {
  const { toast } = useToast();
  const store = useWorkflowStore();

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [schemaJsonInput, setSchemaJsonInput] = useState("{}");
  const [schemaJsonError, setSchemaJsonError] = useState("");
  const [existingSchemas, setExistingSchemas] = useState<any[]>([]);
  const [existingSessions, setExistingSessions] = useState<any[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [showParsed, setShowParsed] = useState(false);
  const [activeUploadTab, setActiveUploadTab] = useState<"single" | "batch" | "zip">("single");

  useEffect(() => {
    if (store.currentStep === 1) {
      setLoadingSchemas(true);
      api.listSchemas()
        .then((r) => setExistingSchemas(r.data?.items || r.data || []))
        .catch(() => { })
        .finally(() => setLoadingSchemas(false));
    }
    if (store.currentStep === 2) {
      api.listSessions()
        .then((r) => setExistingSessions(r.data?.items || r.data || []))
        .catch(() => { });
    }
  }, [store.currentStep]);

  // ── Upload (unchanged behaviour) ─────────────────────────────
  const handleUpload = async (files: FileList | null, type: "single" | "batch" | "zip") => {
    if (!files?.length) return;
    setUploading(true);
    try {
      let res: any;
      if (type === "single") res = await api.uploadSingle(files[0]);
      else if (type === "batch") res = await api.uploadBatch(Array.from(files));
      else res = await api.uploadFolderZip(files[0]);

      const raw = res.data;
      const docs = Array.isArray(raw) ? raw
        : raw?.documents ? raw.documents
          : raw?.document_id ? [raw]
            : [];
      if (!docs.length) throw new Error("No documents returned");
      store.addUploadedDocs(docs);
      if (docs[0]?.document_id) store.setSelectedDoc(docs[0].document_id);
      toast({ title: `${docs.length} document${docs.length > 1 ? "s" : ""} uploaded` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // ── Parse ALL documents simultaneously ───────────────────────
  const handleParseAll = async () => {
    const docs = store.uploadedDocs;
    if (!docs.length) return;

    // Mark every doc as "parsing" right away so all badges update instantly
    docs.forEach((doc) =>
      store.setParseStatus(doc.document_id, "parsing")
    );
    setShowParsed(false);

    // Fire every parse request in parallel
    await Promise.allSettled(
      docs.map(async (doc) => {
        try {
          const res = await api.getParsedDocument(doc.document_id);
          store.setParseStatus(doc.document_id, "done", res.data || res);
        } catch (err: any) {
          store.setParseStatus(doc.document_id, "error", undefined, err.message);
        }
      })
    );

    const doneCount = docs.filter(
      (d) => store.parseStatuses[d.document_id] === "done"
    ).length;

    toast({
      title: `Parsing complete — ${doneCount}/${docs.length} succeeded`,
    });

    // Auto-show preview for the selected doc if it parsed successfully
    if (store.parseResults[store.selectedDocId]) setShowParsed(true);
  };

  // ── Extract ALL documents simultaneously (Step 3) ────────────
  const handleExtractAll = async () => {
    if (!store.sessionId) {
      toast({ title: "Missing session", description: "Create a session first", variant: "destructive" });
      return;
    }
    const eligibleDocs = store.uploadedDocs.filter((d) => d.document_id);
    if (!eligibleDocs.length) {
      toast({ title: "No documents", description: "Upload documents first", variant: "destructive" });
      return;
    }

    store.setBatchExtracting(true);
    store.setBatchProgress({ done: 0, total: eligibleDocs.length });

    let done = 0;

    await Promise.allSettled(
      eligibleDocs.map(async (doc) => {
        try {
          const res = await api.runExtraction(
            store.sessionId,
            doc.document_id,
            store.schemaId || undefined,
            !store.schemaId && store.schemaDefinition ? store.schemaDefinition : undefined
          );
          store.setBatchExtractionResult(doc.document_id, res.data || res);
          // Also set the single result for the selected doc (so Step 4 preview works)
          if (doc.document_id === store.selectedDocId) {
            store.setExtractionResult(res.data || res);
          }
        } catch (err: any) {
          store.setBatchExtractionResult(doc.document_id, { __error: err.message });
        } finally {
          done++;
          store.setBatchProgress({ done, total: eligibleDocs.length });
        }
      })
    );

    store.setBatchExtracting(false);
    store.setStep(4);
    const successCount = Object.values(store.batchExtractionResults).filter(
      (r) => !r?.__error
    ).length;
    toast({ title: `Extraction complete — ${successCount}/${eligibleDocs.length} succeeded` });
  };

  // ── Export combined results ───────────────────────────────────
  const handleExportAllJSON = () => {
    const payload = store.uploadedDocs.map((doc) => ({
      filename: doc.filename,
      document_id: doc.document_id,
      result: store.batchExtractionResults[doc.document_id] ?? null,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `batch_extraction_${Date.now()}.json`;
    a.click();
  };

  const handleExportAllCSV = () => {
    try {
      const rows: string[][] = [];
      let headers: string[] = ["filename", "document_id"];

      // Collect all unique field keys
      const fieldKeys = new Set<string>();
      store.uploadedDocs.forEach((doc) => {
        const r = store.batchExtractionResults[doc.document_id];
        const data = r?.extracted_data || r?.data;
        if (data && typeof data === "object") {
          Object.keys(data).forEach((k) => fieldKeys.add(k));
        }
      });
      headers = [...headers, ...Array.from(fieldKeys)];
      rows.push(headers);

      store.uploadedDocs.forEach((doc) => {
        const r = store.batchExtractionResults[doc.document_id];
        const data = r?.extracted_data || r?.data || {};
        const row = headers.map((h) => {
          if (h === "filename") return doc.filename;
          if (h === "document_id") return doc.document_id;
          const val = (data as any)[h];
          return val !== undefined ? String(val) : "";
        });
        rows.push(row);
      });

      const csv = rows
        .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `batch_extraction_${Date.now()}.csv`;
      a.click();
    } catch (e) {
      toast({ title: "CSV export failed", variant: "destructive" });
    }
  };

  // ── Schema helpers (unchanged) ────────────────────────────────
  const validateSchemaJson = (json: string) => {
    try {
      const p = JSON.parse(json);
      if (typeof p !== "object" || p === null || Array.isArray(p)) {
        setSchemaJsonError("Schema must be a JSON object");
        return false;
      }
      setSchemaJsonError("");
      return true;
    } catch (e: any) {
      setSchemaJsonError(`Invalid JSON: ${e.message}`);
      return false;
    }
  };

  const handleSchemaUpload = async (file: File) => {
    try {
      const text = await file.text();
      if (!validateSchemaJson(text)) return;
      const res = await api.uploadSchema(file);
      const s = res.data || res;
      store.setSchemaId(s.schema_id || "");
      store.setSchemaDefinition(s.schema_definition || JSON.parse(text));
      store.setSchemaName(s.name || file.name);
      store.setSchemaValid(true);
      toast({ title: "Schema loaded", description: s.name || file.name });
    } catch (err: any) {
      toast({ title: "Schema upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSchemaPaste = () => {
    if (!validateSchemaJson(schemaJsonInput)) return;
    store.setSchemaDefinition(JSON.parse(schemaJsonInput));
    store.setSchemaValid(true);
    store.setSchemaId("");
    store.setSchemaName("Inline Schema");
    toast({ title: "Schema applied" });
  };

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      const needsProvider = store.sessionMode === "ai" || store.sessionMode === "hybrid";
      const payload: any = {
        session_id: crypto.randomUUID(),
        mode: store.sessionMode,
        provider: needsProvider ? store.sessionProvider : "none",
      };
      if (needsProvider && store.providerConfig.api_key)
        payload.provider_config = { ...store.providerConfig };
      const res = await api.createSession(payload);
      const s = res.data || res;
      const sid = s.session_id || s.id || "";
      if (!sid) throw new Error("No session_id returned");
      store.setSessionId(sid);
      store.setSessionCreated(true);
      toast({ title: "Session created" });
    } catch (err: any) {
      toast({ title: "Session failed", description: err.message, variant: "destructive" });
    } finally {
      setCreatingSession(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files, e.dataTransfer.files.length > 1 ? "batch" : "single");
  }, []);

  const canAdvance = (step: number) => {
    if (step === 0) return store.uploadedDocs.length > 0 && !!store.selectedDocId;
    if (step === 1) return store.schemaSource === "skip" || store.schemaValid;
    if (step === 2) return store.sessionCreated && !!store.sessionId;
    if (step === 3) return Object.keys(store.batchExtractionResults).length > 0;
    return true;
  };

  const goNext = () => { if (canAdvance(store.currentStep)) store.setStep(store.currentStep + 1); };
  const needsProvider = store.sessionMode === "ai" || store.sessionMode === "hybrid";

  // ── Helpers ───────────────────────────────────────────────────
  const allParsesDone = store.uploadedDocs.length > 0 &&
    store.uploadedDocs.every((d) =>
      store.parseStatuses[d.document_id] === "done" ||
      store.parseStatuses[d.document_id] === "error"
    );
  const anyParsing = store.uploadedDocs.some(
    (d) => store.parseStatuses[d.document_id] === "parsing"
  );
  const parsedCount = store.uploadedDocs.filter(
    (d) => store.parseStatuses[d.document_id] === "done"
  ).length;

  const batchResultCount = Object.values(store.batchExtractionResults).filter(
    (r) => !r?.__error
  ).length;

  // ── Stepper ────────────────────────────────────────────────
  const Stepper = () => (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = i < store.currentStep;
        const active = i === store.currentStep;
        const locked = i > store.currentStep;
        return (
          <div key={s} className="flex items-center">
            <button
              onClick={() => !locked && store.setStep(i)}
              disabled={locked}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-medium tracking-wide transition-all whitespace-nowrap ${active ? "text-primary"
                  : done ? "text-emerald-400 cursor-pointer"
                    : "text-muted-foreground/50 cursor-not-allowed"
                }`}
              style={
                active ? { background: "hsl(185 72% 44% / 0.08)", border: "1px solid hsl(185 72% 44% / 0.22)" }
                  : done ? { background: "hsl(148 58% 40% / 0.06)", border: "1px solid hsl(148 58% 40% / 0.18)" }
                    : { background: "transparent", border: "1px solid transparent" }
              }
            >
              {done
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono"
                  style={{ background: active ? "hsl(185 72% 44% / 0.2)" : "hsl(220 26% 12%)" }}>
                  {i + 1}
                </span>
              }
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
    <div className="mt-5 flex justify-end">
      <button onClick={goNext} disabled={!canAdvance(step)} className="btn btn-primary glow-primary">
        {label} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="relative z-10 pt-[52px] min-h-screen">
      <div className="max-w-4xl mx-auto px-5 py-8">

        {/* Header */}
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

          {/* ── STEP 0: UPLOAD ──────────────────────────────────── */}
          {store.currentStep === 0 && (
            <motion.div key="step-upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

              {/* Upload method tabs */}
              <div className="mb-4 flex items-center gap-1 p-1 rounded-lg w-fit"
                style={{ background: "hsl(220 40% 7%)", border: "1px solid hsl(220 24% 13%)" }}>
                {(["single", "batch", "zip"] as const).map((id) => {
                  const map = {
                    single: { icon: File, label: "Single File" },
                    batch: { icon: Files, label: "Batch Upload" },
                    zip: { icon: FileArchive, label: "ZIP Folder" },
                  };
                  const { icon: Icon, label } = map[id];
                  return (
                    <button key={id} onClick={() => setActiveUploadTab(id)}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeUploadTab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className="rounded-xl transition-all"
                style={{
                  border: `2px dashed ${dragOver ? "hsl(185 72% 44% / 0.6)" : "hsl(220 24% 20%)"}`,
                  background: dragOver ? "hsl(185 72% 44% / 0.04)" : "hsl(220 40% 6% / 0.5)",
                  padding: "3rem 2rem",
                }}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm font-medium text-primary">Uploading…</p>
                    <p className="text-xs text-muted-foreground">This may take a moment</p>
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
                      {activeUploadTab === "single" && (
                        <label className="btn btn-primary glow-primary cursor-pointer">
                          <FileUp className="w-4 h-4" /> Choose File
                          <input type="file" className="hidden" onChange={e => handleUpload(e.target.files, "single")} />
                        </label>
                      )}
                      {activeUploadTab === "batch" && (
                        <label className="btn btn-primary glow-primary cursor-pointer">
                          <Files className="w-4 h-4" /> Choose Files
                          <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, "batch")} />
                        </label>
                      )}
                      {activeUploadTab === "zip" && (
                        <label className="btn btn-primary glow-primary cursor-pointer">
                          <FileArchive className="w-4 h-4" /> Choose ZIP
                          <input type="file" accept=".zip" className="hidden" onChange={e => handleUpload(e.target.files, "zip")} />
                        </label>
                      )}
                      {activeUploadTab !== "single" && (
                        <label className="btn btn-ghost cursor-pointer">
                          <File className="w-4 h-4" /> Single File
                          <input type="file" className="hidden" onChange={e => handleUpload(e.target.files, "single")} />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Uploaded documents + Batch Parse */}
              {store.uploadedDocs.length > 0 && (
                <div className="mt-5 space-y-3">
                  {/* Header row with parse-all button */}
                  <div className="flex items-center justify-between">
                    <p className="section-label">
                      Uploaded Documents ({store.uploadedDocs.length})
                    </p>
                    {allParsesDone && (
                      <span className="text-[10px] font-mono text-emerald-400">
                        {parsedCount}/{store.uploadedDocs.length} parsed
                      </span>
                    )}
                  </div>

                  {/* Document cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {store.uploadedDocs.map((doc, i) => {
                      const ps = store.parseStatuses[doc.document_id];
                      return (
                        <motion.div key={i}
                          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                          onClick={() => {
                            store.setSelectedDoc(doc.document_id);
                            if (store.parseResults[doc.document_id]) setShowParsed(true);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${store.selectedDocId === doc.document_id ? "glow-primary" : "hover:border-primary/15"
                            }`}
                          style={{
                            background: "hsl(220 40% 7%)",
                            border: store.selectedDocId === doc.document_id
                              ? "1px solid hsl(185 72% 44% / 0.35)"
                              : "1px solid hsl(220 24% 13%)",
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: "hsl(185 72% 44% / 0.08)", border: "1px solid hsl(185 72% 44% / 0.14)" }}>
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{doc.filename || `Document ${i + 1}`}</p>
                            <p className="text-[10px] font-mono text-muted-foreground truncate">{doc.document_id}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <ParsePill status={ps} />
                            {store.selectedDocId === doc.document_id && (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* ── Parse ALL button (the main upgrade) ── */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      onClick={handleParseAll}
                      disabled={anyParsing}
                      className="btn btn-primary glow-primary"
                    >
                      {anyParsing ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Parsing {store.uploadedDocs.length} files…</>
                      ) : (
                        <><FileSearch className="w-3.5 h-3.5" />
                          {allParsesDone
                            ? `Re-parse All (${store.uploadedDocs.length})`
                            : `Parse All (${store.uploadedDocs.length})`}
                        </>
                      )}
                    </button>

                    {store.parseResults[store.selectedDocId] && (
                      <button onClick={() => setShowParsed(!showParsed)} className="btn btn-ghost btn-sm">
                        {showParsed
                          ? <><EyeOff className="w-3.5 h-3.5" /> Hide Preview</>
                          : <><Eye className="w-3.5 h-3.5" /> View Preview</>
                        }
                      </button>
                    )}
                  </div>

                  {/* Parse progress */}
                  {anyParsing && (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded-full overflow-hidden"
                        style={{ background: "hsl(220 24% 13%)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: "hsl(185 72% 44%)" }}
                          animate={{ width: `${(parsedCount / store.uploadedDocs.length) * 100}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {parsedCount}/{store.uploadedDocs.length} files parsed
                      </p>
                    </div>
                  )}

                  {/* Parsed preview panel (for selected doc) */}
                  <AnimatePresence>
                    {showParsed && store.parseResults[store.selectedDocId] && (() => {
                      const pc = store.parseResults[store.selectedDocId];
                      return (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                          <div className="rounded-xl overflow-hidden"
                            style={{ background: "hsl(220 45% 4%)", border: "1px solid hsl(220 24% 13%)" }}>
                            {/* Preview header */}
                            <div className="flex items-center justify-between px-4 py-2.5"
                              style={{ borderBottom: "1px solid hsl(220 24% 13%)" }}>
                              <div className="flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[11px] font-mono text-muted-foreground">parsed_document.json</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {pc.document_text && (
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {pc.document_text.length.toLocaleString()} chars
                                  </span>
                                )}
                                {pc.tables && (
                                  <span className="pill-info text-[9px]">{pc.tables.length} tables</span>
                                )}
                                <button onClick={() => setShowParsed(false)} className="p-0.5 rounded text-muted-foreground hover:text-foreground">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {pc.document_text && (
                              <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(220 24% 11%)" }}>
                                <p className="text-[10px] font-mono text-primary/60 uppercase tracking-wider mb-2">Document Text</p>
                                <p className="text-[11px] font-mono text-muted-foreground leading-relaxed line-clamp-6 whitespace-pre-wrap">
                                  {pc.document_text}
                                </p>
                              </div>
                            )}

                            {pc.tables?.length > 0 && (
                              <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(220 24% 11%)" }}>
                                <p className="text-[10px] font-mono text-primary/60 uppercase tracking-wider mb-2">
                                  Tables ({pc.tables.length})
                                </p>
                                {pc.tables.slice(0, 1).map((table: any[], ti: number) => (
                                  <div key={ti} className="overflow-x-auto">
                                    <table className="text-[10px] font-mono border-collapse w-full">
                                      {Array.isArray(table) && table.slice(0, 4).map((row: any[], ri: number) => (
                                        <tr key={ri} style={{ borderBottom: "1px solid hsl(220 24% 11%)" }}>
                                          {(Array.isArray(row) ? row : []).map((cell: any, ci: number) => (
                                            <td key={ci} className={`px-2 py-1 text-left whitespace-nowrap max-w-[120px] truncate ${ri === 0 ? "text-primary/80 font-semibold" : "text-muted-foreground"
                                              }`}>{cell ?? "—"}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </table>
                                  </div>
                                ))}
                              </div>
                            )}

                            <details className="group">
                              <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer text-[10px] font-mono text-muted-foreground hover:text-foreground">
                                <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                                Raw JSON
                              </summary>
                              <div className="px-4 pb-4 max-h-48 overflow-auto">
                                <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                                  {JSON.stringify(pc, null, 2)}
                                </pre>
                              </div>
                            </details>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>

                  <ContinueBtn label="Continue to Schema" step={0} />
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP 1: SCHEMA (unchanged) ───────────────────────── */}
          {store.currentStep === 1 && (
            <motion.div key="step-schema" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <HUDFrame label="Schema Configuration">
                <div>
                  <p className="text-sm font-medium text-foreground mb-4">Choose how to provide your extraction schema</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                    {([
                      { id: "upload", label: "Upload JSON", icon: FileUp },
                      { id: "paste", label: "Paste JSON", icon: Code },
                      { id: "existing", label: "Saved Schemas", icon: List },
                      { id: "skip", label: "Skip / Auto", icon: SkipForward },
                    ] as { id: SchemaSource; label: string; icon: any }[]).map(opt => {
                      const active = store.schemaSource === opt.id;
                      return (
                        <button key={opt.id}
                          onClick={() => {
                            store.setSchemaSource(opt.id);
                            if (opt.id === "skip") { store.setSchemaValid(false); store.setSchemaId(""); store.setSchemaDefinition(null); }
                          }}
                          className="flex flex-col items-center gap-2 p-3.5 rounded-xl text-center transition-all"
                          style={{
                            background: active ? "hsl(185 72% 44% / 0.08)" : "hsl(220 26% 9%)",
                            border: `1px solid ${active ? "hsl(185 72% 44% / 0.28)" : "hsl(220 24% 14%)"}`,
                          }}>
                          <opt.icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {store.schemaSource === "upload" && (
                    <div className="space-y-3">
                      <label className="block w-full rounded-xl p-6 text-center cursor-pointer transition-all"
                        style={{ background: "hsl(220 26% 9%)", border: "2px dashed hsl(220 24% 18%)" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "hsl(185 72% 44% / 0.35)")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(220 24% 18%)")}>
                        <FileUp className="w-8 h-8 text-primary/50 mx-auto mb-2" />
                        <p className="text-sm font-medium text-foreground mb-1">Drop your .json schema file</p>
                        <p className="text-xs text-muted-foreground">or click to browse</p>
                        <input type="file" accept=".json" className="hidden"
                          onChange={e => e.target.files?.[0] && handleSchemaUpload(e.target.files[0])} />
                      </label>
                      {store.schemaValid && store.schemaName && (
                        <div className="flex items-center gap-2 p-3 rounded-lg"
                          style={{ background: "hsl(148 58% 40% / 0.06)", border: "1px solid hsl(148 58% 40% / 0.2)" }}>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm text-emerald-400 font-medium">{store.schemaName}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {store.schemaSource === "paste" && (
                    <div className="space-y-3">
                      <textarea value={schemaJsonInput}
                        onChange={e => { setSchemaJsonInput(e.target.value); setSchemaJsonError(""); }}
                        rows={10}
                        placeholder={'{\n  "fields": [\n    { "name": "model_number", "type": "string" }\n  ]\n}'}
                        className="input-base resize-none leading-relaxed"
                        style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px" }}
                      />
                      {schemaJsonError && (
                        <div className="flex items-center gap-2 text-xs text-red-400">
                          <AlertCircle className="w-3.5 h-3.5" /> {schemaJsonError}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button onClick={handleSchemaPaste} className="btn btn-primary glow-primary">
                          <CheckCircle2 className="w-4 h-4" /> Validate & Apply
                        </button>
                        <button onClick={() => { try { setSchemaJsonInput(JSON.stringify(JSON.parse(schemaJsonInput), null, 2)); } catch { } }}
                          className="btn btn-ghost">
                          Format JSON
                        </button>
                      </div>
                    </div>
                  )}

                  {store.schemaSource === "existing" && (
                    <div className="space-y-2">
                      {loadingSchemas ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading schemas…
                        </div>
                      ) : existingSchemas.length === 0 ? (
                        <div className="text-center py-8">
                          <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No saved schemas found</p>
                        </div>
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
                    <div className="p-4 rounded-xl text-center"
                      style={{ background: "hsl(220 26% 9%)", border: "1px solid hsl(220 24% 14%)" }}>
                      <SkipForward className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No schema — backend will attempt automatic extraction</p>
                    </div>
                  )}

                  {store.schemaValid && (
                    <div className="mt-4 flex items-center gap-2.5 p-3 rounded-lg"
                      style={{ background: "hsl(148 58% 40% / 0.06)", border: "1px solid hsl(148 58% 40% / 0.18)" }}>
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

          {/* ── STEP 2: SESSION (unchanged) ──────────────────────── */}
          {store.currentStep === 2 && (
            <motion.div key="step-session" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <HUDFrame label="Session Configuration">
                {store.sessionCreated ? (
                  <div className="p-4 rounded-xl"
                    style={{ background: "hsl(148 58% 40% / 0.05)", border: "1px solid hsl(148 58% 40% / 0.18)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="font-semibold text-emerald-400">Session Active</span>
                      </div>
                      <button onClick={() => { store.setSessionCreated(false); store.setSessionId(""); }}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono">
                        <RotateCcw className="w-3 h-3" /> Change
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { label: "Session ID", value: store.sessionId.slice(0, 16) + "…" },
                        { label: "Mode", value: store.sessionMode },
                        { label: "Provider", value: store.sessionProvider },
                      ].map(item => (
                        <div key={item.label} className="p-2.5 rounded-lg"
                          style={{ background: "hsl(220 40% 7%)", border: "1px solid hsl(220 24% 13%)" }}>
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
                              className="p-3 rounded-lg text-left transition-all hover:border-primary/20"
                              style={{ background: "hsl(220 26% 9%)", border: "1px solid hsl(220 24% 14%)" }}>
                              <p className="text-[10px] font-mono text-foreground truncate">{s.session_id}</p>
                              <div className="flex gap-1.5 mt-1.5">
                                <span className="pill-info text-[9px]">{s.mode}</span>
                                <span className="pill-accent text-[9px]">{s.provider}</span>
                              </div>
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

                        <div className="p-4 rounded-xl space-y-3"
                          style={{ background: "hsl(220 26% 8%)", border: "1px solid hsl(220 24% 13%)" }}>
                          <p className="section-label">Provider Configuration</p>
                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1.5">API Key</label>
                            <input type="password" value={store.providerConfig.api_key || ""}
                              onChange={e => store.setProviderConfig({ ...store.providerConfig, api_key: e.target.value })}
                              placeholder="Enter API key…" className="input-base" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] text-muted-foreground block mb-1.5">Model (optional)</label>
                              <input value={store.providerConfig.model || ""}
                                onChange={e => store.setProviderConfig({ ...store.providerConfig, model: e.target.value })}
                                placeholder="e.g. gpt-4o" className="input-base" />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground block mb-1.5">Base URL (optional)</label>
                              <input value={store.providerConfig.base_url || ""}
                                onChange={e => store.setProviderConfig({ ...store.providerConfig, base_url: e.target.value })}
                                placeholder="Custom endpoint" className="input-base" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <button onClick={handleCreateSession} disabled={creatingSession}
                      className="w-full btn btn-primary glow-primary justify-center py-3">
                      {creatingSession
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Initializing…</>
                        : <><Zap className="w-4 h-4" /> Initialize Session</>
                      }
                    </button>
                  </div>
                )}
              </HUDFrame>
              <ContinueBtn label="Continue to Extraction" step={2} />
            </motion.div>
          )}

          {/* ── STEP 3: EXTRACTION — upgraded to extract ALL ─────── */}
          {store.currentStep === 3 && (
            <motion.div key="step-extract" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <HUDFrame label="Batch Extraction">
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    All <span className="text-foreground font-semibold">{store.uploadedDocs.length}</span> uploaded
                    document{store.uploadedDocs.length !== 1 ? "s" : ""} will be extracted simultaneously with one click.
                  </p>

                  {/* Config summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Documents", value: `${store.uploadedDocs.length} file${store.uploadedDocs.length !== 1 ? "s" : ""}`, icon: Files },
                      { label: "Schema", value: store.schemaName || "Auto (none)", icon: Database },
                      { label: "Session", value: `${store.sessionMode} / ${store.sessionProvider}`, icon: Settings, sub: store.sessionId.slice(0, 12) + "…" },
                    ].map(item => (
                      <div key={item.label} className="p-3.5 rounded-xl"
                        style={{ background: "hsl(220 26% 8%)", border: "1px solid hsl(220 24% 13%)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <item.icon className="w-3.5 h-3.5 text-primary/60" />
                          <span className="section-label">{item.label}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{item.value}</p>
                        {"sub" in item && item.sub && <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{item.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Per-doc status while running */}
                  {store.batchExtracting && (
                    <div className="space-y-2">
                      <p className="section-label">Progress — {store.batchProgress.done}/{store.batchProgress.total}</p>
                      <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "hsl(220 24% 13%)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: "hsl(185 72% 44%)" }}
                          animate={{ width: `${(store.batchProgress.done / store.batchProgress.total) * 100}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                        {store.uploadedDocs.map((doc) => {
                          const r = store.batchExtractionResults[doc.document_id];
                          const done = r !== undefined;
                          const err = r?.__error;
                          return (
                            <div key={doc.document_id} className="flex items-center gap-2 p-2 rounded-lg text-[11px]"
                              style={{ background: "hsl(220 26% 8%)", border: "1px solid hsl(220 24% 13%)" }}>
                              {done
                                ? err
                                  ? <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                                  : <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                : <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />
                              }
                              <span className="truncate text-muted-foreground">{doc.filename}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Extract All button */}
                  <button
                    onClick={handleExtractAll}
                    disabled={store.batchExtracting}
                    className="w-full btn btn-primary glow-primary justify-center py-3.5 text-base"
                  >
                    {store.batchExtracting
                      ? <><Loader2 className="w-5 h-5 animate-spin" /> Extracting {store.batchProgress.done}/{store.batchProgress.total}…</>
                      : <><PlayCircle className="w-5 h-5" /> Extract All ({store.uploadedDocs.length}) Documents</>
                    }
                  </button>
                </div>
              </HUDFrame>
            </motion.div>
          )}

          {/* ── STEP 4: RESULTS — shows ALL results + export ─────── */}
          {store.currentStep === 4 && (
            <motion.div key="step-results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <HUDFrame label="Batch Extraction Results">
                <div className="space-y-5">

                  {/* Summary bar */}
                  <div className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: "hsl(148 58% 40% / 0.06)", border: "1px solid hsl(148 58% 40% / 0.18)" }}>
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-400">
                          {batchResultCount}/{store.uploadedDocs.length} documents extracted
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {Object.values(store.batchExtractionResults).filter((r) => r?.__error).length} failed
                        </p>
                      </div>
                    </div>
                    {/* Export buttons */}
                    <div className="flex items-center gap-2">
                      <button onClick={handleExportAllJSON} className="btn btn-primary btn-sm">
                        <Download className="w-3.5 h-3.5" /> JSON
                      </button>
                      <button onClick={handleExportAllCSV} className="btn btn-ghost btn-sm">
                        <Download className="w-3.5 h-3.5" /> CSV
                      </button>
                    </div>
                  </div>

                  {/* Per-document result cards */}
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {store.uploadedDocs.map((doc) => {
                      const r = store.batchExtractionResults[doc.document_id];
                      const err = r?.__error as string | undefined;
                      const data = r?.extracted_data || r?.data;
                      const entries = data && typeof data === "object" ? Object.entries(data) : [];

                      return (
                        <details key={doc.document_id}
                          className="group rounded-xl overflow-hidden"
                          style={{ background: "hsl(220 26% 8%)", border: `1px solid ${err ? "hsl(0 60% 40% / 0.3)" : "hsl(220 24% 13%)"}` }}>
                          <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                            {err
                              ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                              : r
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                : <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{doc.filename}</p>
                              <p className="text-[10px] font-mono text-muted-foreground truncate">{doc.document_id}</p>
                            </div>
                            {entries.length > 0 && (
                              <span className="text-[10px] font-mono text-primary/70 mr-2">{entries.length} fields</span>
                            )}
                            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180 flex-shrink-0" />
                          </summary>

                          <div className="px-4 pb-4 pt-1 border-t border-[hsl(220_24%_13%)]">
                            {err ? (
                              <p className="text-xs text-red-400 font-mono">{err}</p>
                            ) : entries.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                {entries.map(([key, val]) => (
                                  <div key={key} className="p-2.5 rounded-lg"
                                    style={{ background: "hsl(220 40% 6%)", border: "1px solid hsl(220 24% 11%)" }}>
                                    <p className="text-[9px] font-mono text-primary/60 uppercase tracking-wider mb-0.5">{key}</p>
                                    <p className="text-xs text-foreground font-mono break-all">
                                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap mt-2 max-h-32 overflow-auto">
                                {JSON.stringify(r, null, 2)}
                              </pre>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>

                  {/* Start new */}
                  <div className="pt-1">
                    <button onClick={() => store.resetWorkflow()} className="btn btn-ghost">
                      <RotateCcw className="w-4 h-4" /> Start New Extraction
                    </button>
                  </div>
                </div>
              </HUDFrame>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// tiny Clock icon used in results
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}