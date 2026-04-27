import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { useWorkflowStore, ExtractionMode, SchemaSource } from "@/stores/workflowStore";
import { PageHeader, GlassCard, HUDFrame } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileUp, FolderArchive, FileSearch, Cpu, Zap, Download,
  CheckCircle2, Loader2, Eye, EyeOff, Database, Settings, ArrowRight,
  RotateCcw, AlertCircle, FileText, Code, List, SkipForward,
  X, Table2, ChevronDown,
} from "lucide-react";

const STEPS = ["Upload", "Schema", "Session", "Extraction", "Results"];

const MODES: { id: ExtractionMode; label: string; icon: any; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Zap, desc: "Auto-select best engine" },
  { id: "python", label: "Python", icon: Cpu, desc: "Python-based extraction" },
  { id: "ai", label: "AI", icon: Database, desc: "AI model extraction" },
  { id: "hybrid", label: "Hybrid", icon: Settings, desc: "Combined approach" },
];

const PROVIDERS = ["groq", "openai", "gemini", "landingai", "ollama"];

type GenericRow = Record<string, any>;

type ProgressDocStatus = {
  document_id: string;
  filename: string;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
};

type ExtractionProgressState = {
  active: boolean;
  mode: "single" | "batch" | "zip" | null;
  batchId: string | null;
  total: number;
  completed: number;
  failed: number;
  progress: number;
  label: string;
  docs: ProgressDocStatus[];
};

function dedupeFields(fields: string[] = []): string[] {
  return Array.from(new Set(fields.map((f) => String(f || "").trim()).filter(Boolean)));
}

function cellValue(v: any): string {
  if (v === null || v === undefined || v === "") return "NULL";
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      return s.length > 120 ? `${s.slice(0, 120)}...` : s;
    } catch {
      return "[Object]";
    }
  }
  return String(v);
}

function inferColumnsFromRows(rows: GenericRow[] = []): string[] {
  return Array.from(
    new Set(
      rows.flatMap((r) => Object.keys(r || {})).filter((k) => !k.startsWith("_") && !k.startsWith("__"))
    )
  );
}

function extractSchemaFieldsFromDefinition(definition: any): string[] {
  const fields = definition?.fields;

  if (Array.isArray(fields)) {
    return dedupeFields(
      fields
        .map((f: any) => (typeof f === "string" ? f : f?.name))
        .filter(Boolean)
    );
  }

  if (fields && typeof fields === "object") {
    return dedupeFields(Object.keys(fields));
  }

  return [];
}

function extractSchemaFieldsFromPayload(payload: any): string[] {
  const schemaFields = payload?.schema_fields;
  if (!Array.isArray(schemaFields)) return [];
  return dedupeFields(schemaFields.map((f: any) => String(f)));
}

function extractRecordsFromPayload(data: any): GenericRow[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data.map((r) => (typeof r === "object" && r !== null ? r : { value: String(r) }));
  }

  if (typeof data === "object") {
    const listKey = ["records", "models", "items", "rows"].find((k) => Array.isArray(data[k]));
    if (listKey) {
      return data[listKey].map((r: any) => (typeof r === "object" && r !== null ? r : { value: String(r) }));
    }
    return [data];
  }

  return [{ value: String(data) }];
}

function normalizeRowsToSchema(
  rows: GenericRow[] = [],
  schemaFields: string[] = [],
  extra?: Record<string, any>
): GenericRow[] {
  const cols = dedupeFields(schemaFields);
  return rows.map((row) => {
    const out: GenericRow = { ...(extra || {}) };

    if (cols.length > 0) {
      cols.forEach((field) => {
        out[field] = row?.[field] ?? "NULL";
      });
    } else {
      Object.entries(row || {}).forEach(([key, value]) => {
        out[key] = value;
      });
    }

    for (const [key, value] of Object.entries(row || {})) {
      if (key.startsWith("_")) {
        out[key] = value;
      }
    }

    return out;
  });
}

function buildSchemaFieldList(
  resultSchemaFields: string[] | undefined,
  storeSchemaDefinition: any,
  rows: GenericRow[]
): string[] {
  const backendFields = dedupeFields(resultSchemaFields || []);
  if (backendFields.length) return backendFields;

  const storeFields = extractSchemaFieldsFromDefinition(storeSchemaDefinition);
  if (storeFields.length) return storeFields;

  return inferColumnsFromRows(rows);
}

function downloadCSVFromRows(rows: GenericRow[], cols: string[], filename: string) {
  if (!rows.length || !cols.length) return;
  const lines = [
    cols.join(","),
    ...rows.map((row) =>
      cols.map((c) => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function extractUploadedDocsFromResponse(res: any): any[] {
  const candidates = [
    res?.data?.documents,
    res?.documents,
    res?.data?.items,
    res?.items,
    res?.data,
    res,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const docs = candidate.filter((d) => d && typeof d === "object");
      if (docs.length) return docs;
    }
  }

  const singleCandidates = [
    res?.data?.document,
    res?.document,
    res?.data?.item,
    res?.item,
    res?.data,
    res,
  ];

  for (const candidate of singleCandidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      (candidate.document_id || candidate.filename || candidate.id)
    ) {
      return [candidate];
    }
  }

  return [];
}

function buildInitialProgressDocs(docs: { document_id: string; filename: string }[]): ProgressDocStatus[] {
  return docs.map((d, idx) => ({
    document_id: d.document_id || `doc-${idx}`,
    filename: d.filename || `Document ${idx + 1}`,
    status: "pending",
  }));
}

function updateProgressDocsFromJobs(
  existing: ProgressDocStatus[],
  jobs: any[] = [],
  errors: any[] = []
): ProgressDocStatus[] {
  const map = new Map(existing.map((d) => [d.document_id, { ...d }]));

  for (const job of jobs || []) {
    const id = job?.document_id;
    if (!id) continue;
    const current = map.get(id);
    if (!current) continue;

    current.status = job?.status === "completed" ? "completed" : "running";
    map.set(id, current);
  }

  for (const err of errors || []) {
    const id = err?.document_id;
    if (!id) continue;
    const current = map.get(id);
    if (!current) continue;

    current.status = "failed";
    current.error = err?.error || "Extraction failed";
    map.set(id, current);
  }

  return Array.from(map.values());
}

async function tryFetchBatchProgress(batchId: string): Promise<any | null> {
  const dynamicApi = api as any;

  if (typeof dynamicApi.getBatch === "function") {
    return dynamicApi.getBatch(batchId);
  }

  if (typeof dynamicApi.getDatabaseBatch === "function") {
    return dynamicApi.getDatabaseBatch(batchId);
  }

  return null;
}

function ProgressPill({ status }: { status: ProgressDocStatus["status"] }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600">
        <CheckCircle2 className="w-3 h-3" /> completed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-red-500">
        <X className="w-3 h-3" /> failed
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-primary">
        <Loader2 className="w-3 h-3 animate-spin" /> running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> pending
    </span>
  );
}

function ExtractionProgressPanel({
  progress,
}: {
  progress: ExtractionProgressState;
}) {
  if (!progress.active) return null;

  const percent = Math.max(0, Math.min(100, progress.progress || 0));

  return (
    <div className="mb-5 p-4 rounded-xl border border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Live Extraction Progress</p>
          <p className="text-[11px] font-mono text-muted-foreground">
            {progress.label || `${progress.completed} / ${progress.total} completed (${percent}%)`}
          </p>
        </div>
        <div className="text-right text-[10px] font-mono text-muted-foreground">
          <div>completed: {progress.completed}</div>
          <div>failed: {progress.failed}</div>
          <div>total: {progress.total}</div>
        </div>
      </div>

      <div className="w-full h-3 rounded-full bg-muted/40 overflow-hidden mb-3">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-44 overflow-auto">
        {progress.docs.map((doc, idx) => (
          <div
            key={doc.document_id || idx}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20 border border-border/30"
          >
            <span className="text-[9px] font-mono w-4 text-center text-muted-foreground">
              {idx + 1}
            </span>
            <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <p className="text-xs text-foreground truncate flex-1">{doc.filename}</p>
            <ProgressPill status={doc.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UploadExtractPage() {
  const { toast } = useToast();
  const store = useWorkflowStore();

  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [schemaJsonInput, setSchemaJsonInput] = useState("{}");
  const [schemaJsonError, setSchemaJsonError] = useState("");
  const [existingSchemas, setExistingSchemas] = useState<any[]>([]);
  const [existingSessions, setExistingSessions] = useState<any[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [showParsedPreview, setShowParsedPreview] = useState(false);

  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgressState>({
    active: false,
    mode: null,
    batchId: null,
    total: 0,
    completed: 0,
    failed: 0,
    progress: 0,
    label: "",
    docs: [],
  });

  useEffect(() => {
    if (store.currentStep === 1) {
      setLoadingSchemas(true);
      api.listSchemas()
        .then((res) => {
          setExistingSchemas(res.data?.items || res.data || []);
        })
        .catch(() => { })
        .finally(() => setLoadingSchemas(false));
    }

    if (store.currentStep === 2) {
      api.listSessions()
        .then((res) => {
          setExistingSessions(res.data?.items || res.data || []);
        })
        .catch(() => { });
    }
  }, [store.currentStep]);

  useEffect(() => {
    if (!extractionProgress.active || !extractionProgress.batchId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await tryFetchBatchProgress(extractionProgress.batchId!);
        if (!res || cancelled) return;

        const payload = res?.data?.data || res?.data || res;
        const jobs = payload?.jobs || [];
        const errors = payload?.errors || [];

        const completed = Number(
          payload?.completed_count ??
          payload?.completed ??
          jobs.filter((j: any) => j?.status === "completed").length ??
          0
        );
        const total = Number(payload?.document_count ?? payload?.total ?? extractionProgress.total);
        const failed = Number(payload?.failed_count ?? errors.length ?? 0);
        const percent = Number(
          payload?.progress_percent ??
          payload?.progress ??
          (total > 0 ? Math.floor((completed / total) * 100) : 0)
        );

        const docs = updateProgressDocsFromJobs(extractionProgress.docs, jobs, errors);

        if (!cancelled) {
          setExtractionProgress((prev) => ({
            ...prev,
            total,
            completed,
            failed,
            progress: percent,
            docs,
            label: `${completed} / ${total} completed (${percent}%)`,
          }));
        }
      } catch {
        // keep UI stable if polling endpoint is unavailable
      }
    };

    poll();
    const interval = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [extractionProgress.active, extractionProgress.batchId]);

  const handleUpload = async (files: FileList | null, type: "single" | "batch" | "zip") => {
    if (!files?.length) return;

    setUploading(true);
    try {
      let res: any;

      if (type === "single") {
        res = await api.uploadSingle(files[0]);
      } else if (type === "batch") {
        res = await api.uploadBatch(Array.from(files));
      } else {
        res = await api.uploadFolderZip(files[0]);
      }

      const docs = extractUploadedDocsFromResponse(res);

      if (docs.length === 0) {
        throw new Error("No documents returned from upload");
      }

      store.addUploadedDocs(docs);

      const firstDocId = docs[0]?.document_id || docs[0]?.id || null;
      if (firstDocId) {
        store.setSelectedDoc(firstDocId);
      }

      toast({
        title: "Upload successful",
        description: `${docs.length} document(s) uploaded`,
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message || "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleParse = async () => {
    if (!store.selectedDocId) return;

    setParsing(true);
    try {
      const res = await api.getParsedDocument(store.selectedDocId);
      store.setParsedContent(res.data || res);
      toast({ title: "Document parsed successfully" });
    } catch (err: any) {
      toast({
        title: "Parse failed",
        description: err?.message || "Parse failed",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const validateSchemaJson = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
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
      if (!validateSchemaJson(text)) {
        toast({
          title: "Invalid schema file",
          description: "File does not contain valid JSON",
          variant: "destructive",
        });
        return;
      }

      const res = await api.uploadSchema(file);
      const schema = res.data || res;

      store.setSchemaId(schema.schema_id || "");
      store.setSchemaDefinition(schema.schema_definition || JSON.parse(text));
      store.setSchemaName(schema.name || file.name);
      store.setSchemaValid(true);

      toast({
        title: "Schema uploaded",
        description: schema.name || file.name,
      });
    } catch (err: any) {
      toast({
        title: "Schema upload failed",
        description: err?.message || "Schema upload failed",
        variant: "destructive",
      });
    }
  };

  const handleSchemaPaste = () => {
    if (!validateSchemaJson(schemaJsonInput)) return;

    const parsed = JSON.parse(schemaJsonInput);
    store.setSchemaDefinition(parsed);
    store.setSchemaValid(true);
    store.setSchemaId("");
    store.setSchemaName("Inline Schema");

    toast({ title: "Schema validated and applied" });
  };

  const handleSelectExistingSchema = (schema: any) => {
    store.setSchemaId(schema.schema_id || "");
    store.setSchemaDefinition(schema.schema_definition || schema.definition_json || schema.definition || null);
    store.setSchemaName(schema.name || "Selected Schema");
    store.setSchemaValid(true);

    toast({
      title: "Schema selected",
      description: schema.name || "Existing schema",
    });
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

      if (needsProvider && store.providerConfig.api_key) {
        payload.provider_config = { ...store.providerConfig };
      }

      const res = await api.createSession(payload);
      const session = res.data || res;
      const sid = session.session_id || session.id || "";

      if (!sid) {
        throw new Error("No session_id returned from backend");
      }

      store.setSessionId(sid);
      store.setSessionCreated(true);

      toast({
        title: "Session created",
        description: `ID: ${sid}`,
      });
    } catch (err: any) {
      toast({
        title: "Session creation failed",
        description: err?.message || "Session creation failed",
        variant: "destructive",
      });
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSelectExistingSession = (session: any) => {
    store.setSessionId(session.session_id || "");
    store.setSessionMode(session.mode || "auto");
    store.setSessionProvider(session.provider || "groq");
    store.setSessionCreated(true);

    toast({
      title: "Session selected",
      description: session.session_id || "Existing session selected",
    });
  };

  const handleExtract = async () => {
    if (!store.sessionId) {
      toast({
        title: "Missing session",
        description: "Session is required",
        variant: "destructive",
      });
      return;
    }

    const allDocIds = store.uploadedDocs.map((d) => d.document_id).filter(Boolean);

    if (!allDocIds.length) {
      toast({
        title: "No documents",
        description: "Upload at least one document",
        variant: "destructive",
      });
      return;
    }

    const mode: "single" | "batch" | "zip" =
      allDocIds.length === 1 ? "single" : "batch";

    setExtractionProgress({
      active: true,
      mode,
      batchId: null,
      total: allDocIds.length,
      completed: 0,
      failed: 0,
      progress: allDocIds.length === 1 ? 15 : 0,
      label: allDocIds.length === 1
        ? "Processing 1 document..."
        : `0 / ${allDocIds.length} completed (0%)`,
      docs: buildInitialProgressDocs(store.uploadedDocs),
    });

    store.setExtracting(true);

    try {
      const schemaId = store.schemaId || undefined;
      const schemaDef = !schemaId && store.schemaDefinition ? store.schemaDefinition : undefined;

      let res: any;

      if (allDocIds.length === 1) {
        setExtractionProgress((prev) => ({
          ...prev,
          progress: 35,
          docs: prev.docs.map((d, i) => i === 0 ? { ...d, status: "running" } : d),
          label: "Processing 1 document...",
        }));

        res = await api.runExtraction(store.sessionId, allDocIds[0], schemaId, schemaDef);

        setExtractionProgress((prev) => ({
          ...prev,
          progress: 100,
          completed: 1,
          failed: 0,
          label: "1 / 1 completed (100%)",
          docs: prev.docs.map((d, i) => i === 0 ? { ...d, status: "completed" } : d),
        }));
      } else {
        res = await api.runBatchExtraction(store.sessionId, allDocIds, schemaId, schemaDef);

        const payload = res?.data || res;
        const batchId = payload?.batch_id || payload?.data?.batch_id || null;
        const jobs = payload?.jobs || payload?.data?.jobs || [];
        const errors = payload?.errors || payload?.data?.errors || [];
        const completed = Number(payload?.completed ?? jobs.filter((j: any) => j?.status === "completed").length ?? 0);
        const failed = Number(payload?.failed ?? errors.length ?? 0);
        const total = Number(payload?.total ?? allDocIds.length);
        const progress = Number(payload?.progress ?? (total > 0 ? Math.floor((completed / total) * 100) : 0));

        setExtractionProgress((prev) => ({
          ...prev,
          batchId,
          total,
          completed,
          failed,
          progress: progress || (completed === total ? 100 : prev.progress),
          label: `${completed} / ${total} completed (${progress || (completed === total ? 100 : 0)}%)`,
          docs: updateProgressDocsFromJobs(prev.docs, jobs, errors),
        }));
      }

      store.setExtractionResult(res.data || res);
      store.setStep(4);

      toast({
        title: "Extraction complete",
        description: `${allDocIds.length} document(s) processed — saved to Database`,
      });
    } catch (err: any) {
      setExtractionProgress((prev) => ({
        ...prev,
        active: false,
      }));

      toast({
        title: "Extraction failed",
        description: err?.message || "Extraction failed",
        variant: "destructive",
      });
    } finally {
      store.setExtracting(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files, e.dataTransfer.files.length > 1 ? "batch" : "single");
  }, []);

  const canAdvance = (from: number): boolean => {
    switch (from) {
      case 0:
        return store.uploadedDocs.length > 0;
      case 1:
        return store.schemaSource === "skip" || store.schemaValid;
      case 2:
        return store.sessionCreated && !!store.sessionId;
      case 3:
        return !!store.extractionResult;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (canAdvance(store.currentStep)) store.setStep(store.currentStep + 1);
  };

  const needsProviderConfig = store.sessionMode === "ai" || store.sessionMode === "hybrid";

  return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-6xl mx-auto">
      <PageHeader title="Upload & Extract" subtitle="End-to-end document extraction pipeline" />

      <div className="flex items-center justify-center gap-1 mb-10 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <button
              onClick={() => i <= store.currentStep && store.setStep(i)}
              disabled={i > store.currentStep + 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono tracking-wider uppercase transition-all ${i === store.currentStep
                  ? "glass-robot text-primary glow-primary"
                  : i < store.currentStep
                    ? "glass-robot text-glow-success cursor-pointer"
                    : "bg-muted/30 text-muted-foreground border border-border/30 rounded-md cursor-not-allowed opacity-50"
                }`}
            >
              {i < store.currentStep ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="text-[10px]">{String(i + 1).padStart(2, "0")}</span>
              )}
              {s}
            </button>
            {i < STEPS.length - 1 && (
              <div className="hidden sm:flex items-center gap-1">
                <div className="w-4 h-px bg-primary/20" />
                <div className={`w-1.5 h-1.5 rounded-full ${i < store.currentStep ? "bg-glow-success/50" : "bg-primary/15"}`} />
                <div className="w-4 h-px bg-primary/20" />
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {store.currentStep === 0 && (
          <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <HUDFrame label="Document Intake">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`glass-robot p-12 text-center border-2 border-dashed transition-all ${dragOver ? "border-primary bg-primary/5" : "border-primary/10"
                  }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-xs font-mono text-primary tracking-wider uppercase animate-pulse">
                      Processing Upload...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl glass-robot flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-display font-bold text-foreground mb-2">
                      Drop files here or choose upload type
                    </h3>
                    <p className="text-muted-foreground text-xs font-mono mb-6">
                      Supports PDF, images, and document files
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <label className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-medium text-sm cursor-pointer flex items-center gap-2 hover:opacity-90 glow-primary">
                        <FileUp className="w-4 h-4" /> Single File
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleUpload(e.target.files, "single")}
                        />
                      </label>

                      <label className="px-6 py-2.5 rounded-lg glass-robot text-foreground font-display font-medium text-sm cursor-pointer flex items-center gap-2 hover:border-primary/30 transition-colors">
                        <Upload className="w-4 h-4" /> Batch Upload
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => handleUpload(e.target.files, "batch")}
                        />
                      </label>

                      <label className="px-6 py-2.5 rounded-lg glass-robot text-foreground font-display font-medium text-sm cursor-pointer flex items-center gap-2 hover:border-primary/30 transition-colors">
                        <FolderArchive className="w-4 h-4" /> ZIP Folder
                        <input
                          type="file"
                          accept=".zip"
                          className="hidden"
                          onChange={(e) => handleUpload(e.target.files, "zip")}
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </HUDFrame>

            {store.uploadedDocs.length > 0 && (
              <>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {store.uploadedDocs.map((doc, i) => (
                    <motion.div
                      key={doc.document_id || i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => store.setSelectedDoc(doc.document_id)}
                      className={`glass-robot p-4 cursor-pointer transition-all robot-corner ${store.selectedDocId === doc.document_id ? "border-primary/40 glow-primary" : ""
                        }`}
                    >
                      <p className="font-medium text-foreground text-sm truncate">
                        {doc.filename || `Document ${i + 1}`}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
                        {doc.document_id}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleParse}
                    disabled={!store.selectedDocId || parsing}
                    className="px-5 py-2 rounded-lg glass-robot text-foreground font-display font-medium text-sm flex items-center gap-2 hover:border-primary/30 transition-colors disabled:opacity-50"
                  >
                    {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
                    Parse Document
                  </button>

                  {store.parsedContent && (
                    <button
                      onClick={() => setShowParsedPreview(!showParsedPreview)}
                      className="px-5 py-2 rounded-lg glass-robot text-foreground font-display font-medium text-sm flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" /> {showParsedPreview ? "Hide" : "View"} Parsed
                    </button>
                  )}
                </div>

                {showParsedPreview && store.parsedContent && (
                  <div className="mt-4 bg-muted/30 rounded-lg p-4 max-h-64 overflow-auto border border-primary/5">
                    <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(store.parsedContent, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={goNext}
                    disabled={!canAdvance(0)}
                    className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-sm flex items-center gap-2 glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue to Schema <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {store.currentStep === 1 && (
          <motion.div key="schema" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <HUDFrame label="Schema Configuration">
              <GlassCard>
                <h3 className="text-base font-display font-bold text-foreground mb-4">Choose Schema Source</h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {([
                    { id: "upload", label: "Upload JSON", icon: FileUp },
                    { id: "paste", label: "Paste JSON", icon: Code },
                    { id: "existing", label: "Select Existing", icon: List },
                    { id: "skip", label: "Skip / Auto", icon: SkipForward },
                  ] as { id: SchemaSource; label: string; icon: any }[]).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        store.setSchemaSource(opt.id);
                        if (opt.id === "skip") {
                          store.setSchemaValid(false);
                          store.setSchemaId("");
                          store.setSchemaDefinition(null);
                          store.setSchemaName("");
                        }
                      }}
                      className={`p-4 rounded-lg text-center transition-all flex flex-col items-center gap-2 ${store.schemaSource === opt.id
                          ? "glass-robot text-primary glow-primary"
                          : "bg-muted/30 text-muted-foreground border border-border/30 hover:border-primary/20"
                        }`}
                    >
                      <opt.icon className="w-5 h-5" />
                      <span className="text-xs font-display font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>

                {store.schemaSource === "upload" && (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs text-muted-foreground font-mono mb-1 block">
                        Upload a .json schema file
                      </span>
                      <input
                        type="file"
                        accept=".json"
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 file:cursor-pointer"
                        onChange={(e) => e.target.files?.[0] && handleSchemaUpload(e.target.files[0])}
                      />
                    </label>

                    {store.schemaValid && store.schemaName && (
                      <div className="flex items-center gap-2 text-sm text-glow-success">
                        <CheckCircle2 className="w-4 h-4" /> Schema loaded: {store.schemaName}
                      </div>
                    )}
                  </div>
                )}

                {store.schemaSource === "paste" && (
                  <div className="space-y-3">
                    <textarea
                      value={schemaJsonInput}
                      onChange={(e) => {
                        setSchemaJsonInput(e.target.value);
                        setSchemaJsonError("");
                      }}
                      rows={8}
                      placeholder='{"field_name": "string", ...}'
                      className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-primary/10 text-foreground text-sm font-mono focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30"
                    />

                    {schemaJsonError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4" /> {schemaJsonError}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSchemaPaste}
                        className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-display font-medium text-sm glow-primary"
                      >
                        Validate & Apply
                      </button>

                      <button
                        onClick={() => {
                          try {
                            setSchemaJsonInput(JSON.stringify(JSON.parse(schemaJsonInput), null, 2));
                          } catch { }
                        }}
                        className="px-5 py-2 rounded-lg glass-robot text-foreground font-display font-medium text-sm"
                      >
                        Format JSON
                      </button>
                    </div>

                    {store.schemaValid && store.schemaSource === "paste" && (
                      <div className="flex items-center gap-2 text-sm text-glow-success">
                        <CheckCircle2 className="w-4 h-4" /> Schema validated and applied
                      </div>
                    )}
                  </div>
                )}

                {store.schemaSource === "existing" && (
                  <div className="space-y-3">
                    {loadingSchemas ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading schemas...
                      </div>
                    ) : existingSchemas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No schemas found on backend. Create one first.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-auto">
                        {existingSchemas.map((s: any) => (
                          <button
                            key={s.schema_id}
                            onClick={() => handleSelectExistingSchema(s)}
                            className={`p-3 rounded-lg text-left transition-all ${store.schemaId === s.schema_id
                                ? "glass-robot text-primary glow-primary"
                                : "bg-muted/30 border border-border/30 hover:border-primary/20"
                              }`}
                          >
                            <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground truncate mt-1">
                              {s.schema_id}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {store.schemaSource === "skip" && (
                  <p className="text-sm text-muted-foreground">
                    No schema will be used. The backend will attempt auto-extraction.
                  </p>
                )}

                {store.schemaValid && (
                  <div className="mt-4 p-3 rounded-lg bg-glow-success/5 border border-glow-success/20">
                    <div className="flex items-center gap-2 text-sm text-glow-success">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">Active Schema:</span>
                      <span className="font-mono">{store.schemaName}</span>
                      {store.schemaId && (
                        <span className="text-[10px] text-muted-foreground ml-2">({store.schemaId})</span>
                      )}
                    </div>
                  </div>
                )}
              </GlassCard>
            </HUDFrame>

            <div className="mt-6 flex justify-end">
              <button
                onClick={goNext}
                disabled={!canAdvance(1)}
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-sm flex items-center gap-2 glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Session <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {store.currentStep === 2 && (
          <motion.div key="session" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <HUDFrame label="Session Configuration">
              <GlassCard>
                <h3 className="text-base font-display font-bold text-foreground mb-4">Configure Extraction Session</h3>

                {existingSessions.length > 0 && !store.sessionCreated && (
                  <div className="mb-6">
                    <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
                      Or select an existing session
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-auto">
                      {existingSessions.map((s: any) => (
                        <button
                          key={s.session_id}
                          onClick={() => handleSelectExistingSession(s)}
                          className="p-3 rounded-lg text-left bg-muted/30 border border-border/30 hover:border-primary/20 transition-all"
                        >
                          <p className="text-xs font-mono text-foreground truncate">{s.session_id}</p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                              {s.mode}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono">
                              {s.provider}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="my-4 flex items-center gap-3">
                      <div className="flex-1 h-px bg-border/50" />
                      <span className="text-[10px] text-muted-foreground font-mono uppercase">or create new</span>
                      <div className="flex-1 h-px bg-border/50" />
                    </div>
                  </div>
                )}

                {!store.sessionCreated ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase block mb-2">
                        Extraction Mode
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {MODES.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => store.setSessionMode(m.id)}
                            className={`p-3 rounded-lg text-center transition-all ${store.sessionMode === m.id
                                ? "glass-robot text-primary glow-primary"
                                : "bg-muted/30 text-muted-foreground border border-border/30 hover:border-primary/20"
                              }`}
                          >
                            <m.icon className="w-4 h-4 mx-auto mb-1" />
                            <span className="text-xs font-display font-medium block">{m.label}</span>
                            <span className="text-[9px] text-muted-foreground">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {needsProviderConfig && (
                      <>
                        <div>
                          <label className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase block mb-2">
                            AI Provider
                          </label>
                          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                            {PROVIDERS.map((p) => (
                              <button
                                key={p}
                                onClick={() => store.setSessionProvider(p)}
                                className={`px-3 py-2 rounded-lg text-xs font-display font-medium tracking-wider uppercase transition-all ${store.sessionProvider === p
                                    ? "glass-robot text-accent glow-accent"
                                    : "bg-muted/30 text-muted-foreground border border-border/30 hover:border-accent/20"
                                  }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/30">
                          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                            Provider Configuration
                          </p>

                          <div>
                            <label className="text-[10px] text-muted-foreground font-mono block mb-1">API Key</label>
                            <input
                              type="password"
                              value={store.providerConfig.api_key || ""}
                              onChange={(e) =>
                                store.setProviderConfig({ ...store.providerConfig, api_key: e.target.value })
                              }
                              placeholder="Enter API key for the selected provider"
                              className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-primary/10 text-foreground text-sm font-mono focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-muted-foreground font-mono block mb-1">
                                Model (optional)
                              </label>
                              <input
                                value={store.providerConfig.model || ""}
                                onChange={(e) =>
                                  store.setProviderConfig({ ...store.providerConfig, model: e.target.value })
                                }
                                placeholder="e.g. gpt-4o"
                                className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-primary/10 text-foreground text-sm font-mono focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-muted-foreground font-mono block mb-1">
                                Base URL (optional)
                              </label>
                              <input
                                value={store.providerConfig.base_url || ""}
                                onChange={(e) =>
                                  store.setProviderConfig({ ...store.providerConfig, base_url: e.target.value })
                                }
                                placeholder="Custom API endpoint"
                                className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-primary/10 text-foreground text-sm font-mono focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      onClick={handleCreateSession}
                      disabled={creatingSession}
                      className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-sm flex items-center justify-center gap-2 glow-primary disabled:opacity-50"
                    >
                      {creatingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Initialize Session
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-glow-success/5 border border-glow-success/20">
                    <div className="flex items-center gap-2 text-glow-success mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-display font-bold">Session Active</span>
                    </div>

                    <div className="space-y-1 text-xs font-mono text-muted-foreground">
                      <p>
                        Session ID: <span className="text-primary">{store.sessionId}</span>
                      </p>
                      <p>
                        Mode: <span className="text-foreground">{store.sessionMode}</span>
                      </p>
                      <p>
                        Provider: <span className="text-foreground">{store.sessionProvider}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        store.setSessionCreated(false);
                        store.setSessionId("");
                      }}
                      className="mt-3 px-4 py-1.5 rounded-lg glass-robot text-foreground font-display font-medium text-xs flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Change Session
                    </button>
                  </div>
                )}
              </GlassCard>
            </HUDFrame>

            <div className="mt-6 flex justify-end">
              <button
                onClick={goNext}
                disabled={!canAdvance(2)}
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-sm flex items-center gap-2 glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Extraction <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {store.currentStep === 3 && (
          <motion.div key="extract" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <HUDFrame label="Extraction Summary">
              <GlassCard>
                <h3 className="text-base font-display font-bold text-foreground mb-4">Review & Execute</h3>

                <ExtractionProgressPanel progress={extractionProgress} />

                <div className="mb-4">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">
                    Documents to Extract ({store.uploadedDocs.length})
                  </p>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {store.uploadedDocs.map((doc, i) => {
                      const progressDoc = extractionProgress.docs.find((d) => d.document_id === doc.document_id);
                      return (
                        <div
                          key={doc.document_id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                          style={{ background: "hsl(var(--muted) / 0.4)", border: "1px solid hsl(var(--border))" }}
                        >
                          <span className="text-[9px] font-mono w-4 text-center flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {i + 1}
                          </span>
                          <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <p className="text-xs text-foreground truncate flex-1">
                            {doc.filename || `Document ${i + 1}`}
                          </p>
                          {progressDoc ? <ProgressPill status={progressDoc.status} /> : null}
                          <p className="text-[9px] font-mono text-muted-foreground flex-shrink-0">
                            {doc.document_id.slice(0, 8)}…
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="p-3 rounded-lg" style={{ background: "hsl(var(--muted) / 0.4)", border: "1px solid hsl(var(--border))" }}>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Schema</p>
                    <p className="text-sm text-foreground font-mono truncate">{store.schemaName || "None (auto)"}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "hsl(var(--muted) / 0.4)", border: "1px solid hsl(var(--border))" }}>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Session</p>
                    <p className="text-sm text-foreground font-mono truncate">
                      {store.sessionMode} · {store.sessionProvider}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleExtract}
                  disabled={store.extracting}
                  className="w-full px-8 py-3.5 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-sm flex items-center justify-center gap-2 glow-primary disabled:opacity-50"
                >
                  {store.extracting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>
                        {extractionProgress.label || `Extracting ${store.uploadedDocs.length} document${store.uploadedDocs.length > 1 ? "s" : ""}...`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      <span>
                        Extract All {store.uploadedDocs.length} Document{store.uploadedDocs.length > 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </button>
              </GlassCard>
            </HUDFrame>
          </motion.div>
        )}

        {store.currentStep === 4 && (
          <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <BatchResultStep
              result={store.extractionResult}
              uploadedDocs={store.uploadedDocs}
              schemaDefinition={store.schemaDefinition}
              onNewExtraction={() => {
                setExtractionProgress({
                  active: false,
                  mode: null,
                  batchId: null,
                  total: 0,
                  completed: 0,
                  failed: 0,
                  progress: 0,
                  label: "",
                  docs: [],
                });
                store.resetWorkflow();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DocJob {
  job_id?: string;
  document_id?: string;
  filename?: string;
  status?: string;
  engine_used?: string;
  schema_fields?: string[];
  extracted_data?: any;
  error?: string;
}

function ResultExcelTable({
  rows,
  columns,
}: {
  rows: Record<string, any>[];
  columns: string[];
}) {
  if (!rows.length) {
    return <p className="text-xs font-mono text-muted-foreground py-3 text-center italic">No data extracted</p>;
  }

  return (
    <div className="overflow-auto rounded-lg border border-primary/15" style={{ maxHeight: "320px" }}>
      <table className="w-full text-xs border-collapse" style={{ minWidth: `${Math.max(columns.length * 130, 380)}px` }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
          <tr className="bg-primary/10">
            <th className="px-2.5 py-2 text-left font-mono font-semibold text-primary/70 border-b border-r border-primary/15 w-8">#</th>
            {columns.map((c) => (
              <th
                key={c}
                className="px-2.5 py-2 text-left font-mono font-semibold text-primary whitespace-nowrap border-b border-r border-primary/15 min-w-[110px]"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-muted/20" : "bg-muted/10"}>
              <td className="px-2.5 py-1.5 font-mono text-center text-muted-foreground border-r border-b border-border/30">
                {ri + 1}
              </td>
              {columns.map((col) => {
                const v = cellValue(row[col]);
                return (
                  <td
                    key={col}
                    className="px-2.5 py-1.5 font-mono whitespace-nowrap border-r border-b border-border/20 max-w-[180px] overflow-hidden text-ellipsis"
                    style={{ color: v === "NULL" ? "hsl(var(--muted-foreground) / 0.4)" : "hsl(var(--foreground))" }}
                    title={v}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchResultStep({
  result,
  uploadedDocs,
  schemaDefinition,
  onNewExtraction,
}: {
  result: any;
  uploadedDocs: { document_id: string; filename: string }[];
  schemaDefinition: any;
  onNewExtraction: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [tab, setTab] = useState<"table" | "json">("table");

  const rootSchemaFields = useMemo(() => extractSchemaFieldsFromPayload(result), [result]);

  const jobs: DocJob[] = useMemo(() => {
    if (!result) return [];

    if (result.jobs) {
      const ok: DocJob[] = (result.jobs || []).map((j: any) => ({
        job_id: j.job_id,
        document_id: j.document_id,
        filename:
          uploadedDocs.find((d) => d.document_id === j.document_id)?.filename ||
          j.filename ||
          j.document_id?.slice(0, 10),
        status: j.status || "completed",
        engine_used: j.engine_used,
        schema_fields: j.schema_fields || rootSchemaFields || [],
        extracted_data: j.extracted_data || j.result || j.data,
      }));

      const err: DocJob[] = (result.errors || []).map((e: any) => ({
        document_id: e.document_id,
        filename: uploadedDocs.find((d) => d.document_id === e.document_id)?.filename || e.document_id?.slice(0, 10),
        status: "failed",
        error: e.error,
        schema_fields: rootSchemaFields || [],
        extracted_data: null,
      }));

      return [...ok, ...err];
    }

    if (result.document_id || result.extracted_data || result.result || result.data) {
      return [{
        job_id: result.job_id,
        document_id: result.document_id,
        filename: uploadedDocs.find((d) => d.document_id === result.document_id)?.filename || result.filename || "Document",
        status: result.status || "completed",
        engine_used: result.engine_used,
        schema_fields: result.schema_fields || rootSchemaFields || [],
        extracted_data: result.extracted_data || result.result || result.data,
      }];
    }

    return [];
  }, [result, uploadedDocs, rootSchemaFields]);

  const total = jobs.length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  const selJob = selectedIdx !== null ? jobs[selectedIdx] : null;

  const selRawRows = useMemo(
    () => (selJob ? extractRecordsFromPayload(selJob.extracted_data) : []),
    [selJob]
  );

  const selColumns = useMemo(
    () => buildSchemaFieldList(selJob?.schema_fields || [], schemaDefinition, selRawRows),
    [selJob, schemaDefinition, selRawRows]
  );

  const selRows = useMemo(
    () => normalizeRowsToSchema(selRawRows, selColumns),
    [selRawRows, selColumns]
  );

  const downloadAllCSV = () => {
    const allSchemaFields = Array.from(
      new Set(
        jobs.flatMap((job) => {
          const rawRows = extractRecordsFromPayload(job.extracted_data);
          return buildSchemaFieldList(job.schema_fields || [], schemaDefinition, rawRows);
        })
      )
    );

    const allRows = jobs.flatMap((job) =>
      normalizeRowsToSchema(
        extractRecordsFromPayload(job.extracted_data),
        allSchemaFields,
        { __document: job.filename || "Document" }
      )
    );

    if (!allRows.length) return;

    const cols = ["__document", ...allSchemaFields];
    downloadCSVFromRows(allRows, cols, "batch_extraction_all.csv");
  };

  const downloadAllJSON = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "batch_extraction_all.json";
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 px-1">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "hsl(148 55% 40% / 0.1)", border: "1px solid hsl(148 55% 40% / 0.22)" }}
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {completed}/{total} extracted
            </p>
            {failed > 0 && <p className="text-xs text-red-500">{failed} failed</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadAllJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground glow-primary"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
          <button
            onClick={downloadAllCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass-robot text-foreground"
          >
            <Download className="w-3.5 h-3.5" /> CSV (All)
          </button>
          <button
            onClick={onNewExtraction}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass-robot text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {jobs.map((job, idx) => {
          const rawRows = extractRecordsFromPayload(job.extracted_data);
          const columns = buildSchemaFieldList(job.schema_fields || [], schemaDefinition, rawRows);
          const rows = normalizeRowsToSchema(rawRows, columns);
          const isSelected = selectedIdx === idx;

          return (
            <div
              key={job.document_id || idx}
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isSelected ? "hsl(var(--primary) / 0.35)" : "hsl(var(--border))"}` }}
            >
              <div
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ background: isSelected ? "hsl(var(--primary) / 0.05)" : "hsl(var(--muted) / 0.25)" }}
              >
                <span className="text-[9px] font-mono w-4 text-center flex-shrink-0 text-muted-foreground">
                  {idx + 1}
                </span>
                <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <p className="text-xs font-medium text-foreground truncate flex-1">{job.filename}</p>

                {job.status === "completed" ? (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> {rows.length} record{rows.length !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-red-500 flex-shrink-0">
                    <X className="w-3 h-3" /> failed
                  </span>
                )}

                {job.engine_used && (
                  <span className="text-[9px] font-mono text-muted-foreground hidden sm:block flex-shrink-0">
                    {job.engine_used}
                  </span>
                )}

                <button
                  onClick={() => {
                    setSelectedIdx(isSelected ? null : idx);
                    setTab("table");
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium flex-shrink-0 transition-all"
                  style={
                    isSelected
                      ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                      : { background: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.2)" }
                  }
                >
                  {isSelected ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> View</>}
                </button>
              </div>

              {job.status === "failed" && job.error && (
                <div
                  className="px-4 py-2 text-xs font-mono text-red-600"
                  style={{ background: "hsl(0 62% 46% / 0.06)", borderTop: "1px solid hsl(0 62% 46% / 0.18)" }}
                >
                  {job.error}
                </div>
              )}

              {isSelected && job.status === "completed" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  style={{ borderTop: "1px solid hsl(var(--border))" }}
                >
                  <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
                      {([["table", Table2, "Table"], ["json", ChevronDown, "JSON"]] as const).map(([t, Icon, lbl]) => (
                        <button
                          key={t}
                          onClick={() => setTab(t as "table" | "json")}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono transition-all"
                          style={{
                            background: tab === t ? "hsl(var(--primary))" : "transparent",
                            color: tab === t ? "white" : "hsl(var(--muted-foreground))",
                          }}
                        >
                          <Icon className="w-3 h-3" /> {lbl}
                        </button>
                      ))}
                    </div>

                    <span className="text-[9px] font-mono text-muted-foreground ml-auto">
                      {rows.length} row{rows.length !== 1 ? "s" : ""} · {columns.length} fields
                    </span>

                    <button
                      onClick={() => {
                        if (!rows.length) return;
                        downloadCSVFromRows(
                          rows,
                          columns,
                          `${(job.filename || "document").replace(/\s/g, "_")}_result.csv`
                        );
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  </div>

                  <div className="px-4 pb-4">
                    {tab === "table" ? (
                      <ResultExcelTable rows={rows} columns={columns} />
                    ) : (
                      <pre className="text-[10px] font-mono text-muted-foreground overflow-auto max-h-64 whitespace-pre-wrap p-3 rounded-lg bg-muted/20 border border-border/30">
                        {JSON.stringify(job.extracted_data, null, 2)}
                      </pre>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] font-mono text-muted-foreground text-center pt-1">
        Full record saved to <span className="text-primary">Database</span> — view history anytime
      </p>
    </div>
  );
}