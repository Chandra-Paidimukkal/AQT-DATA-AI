import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { useWorkflowStore, ExtractionMode, SchemaSource } from "@/stores/workflowStore";
import { PageHeader, GlassCard, HUDFrame } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileUp, FolderArchive, FileSearch, Cpu, Zap, Download,
  CheckCircle2, Loader2, Eye, Database, Settings, ArrowRight,
  RotateCcw, ChevronDown, AlertCircle, Code, List, SkipForward
} from "lucide-react";

const STEPS = ["Upload", "Schema", "Session", "Extract", "Results"];

const MODES: { id: ExtractionMode; label: string; icon: any; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Zap, desc: "Best engine auto-selected" },
  { id: "python", label: "Python", icon: Cpu, desc: "Rule-based extraction" },
  { id: "ai", label: "AI", icon: Database, desc: "AI model powered" },
  { id: "hybrid", label: "Hybrid", icon: Settings, desc: "Combined approach" },
];

const PROVIDERS = ["groq", "openai", "gemini", "landingai", "ollama"];

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

  useEffect(() => {
    if (store.currentStep === 1) {
      setLoadingSchemas(true);
      api.listSchemas().then(res => {
        setExistingSchemas(res.data?.items || res.data || []);
      }).catch(() => {}).finally(() => setLoadingSchemas(false));
    }
    if (store.currentStep === 2) {
      api.listSessions().then(res => {
        setExistingSessions(res.data?.items || res.data || []);
      }).catch(() => {});
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
      const docs = res.data ? (Array.isArray(res.data) ? res.data : [res.data]) : [];
      if (docs.length === 0) throw new Error("No documents returned from upload");
      store.addUploadedDocs(docs);
      if (docs[0]?.document_id) store.setSelectedDoc(docs[0].document_id);
      toast({ title: "Upload successful", description: `${docs.length} document(s) uploaded` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
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
      toast({ title: "Parse failed", description: err.message, variant: "destructive" });
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
        toast({ title: "Invalid schema file", variant: "destructive" });
        return;
      }
      const res = await api.uploadSchema(file);
      const schema = res.data || res;
      store.setSchemaId(schema.schema_id || "");
      store.setSchemaDefinition(schema.schema_definition || JSON.parse(text));
      store.setSchemaName(schema.name || file.name);
      store.setSchemaValid(true);
      toast({ title: "Schema uploaded", description: schema.name || file.name });
    } catch (err: any) {
      toast({ title: "Schema upload failed", description: err.message, variant: "destructive" });
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
    store.setSchemaId(schema.schema_id);
    store.setSchemaDefinition(schema.schema_definition);
    store.setSchemaName(schema.name);
    store.setSchemaValid(true);
    toast({ title: "Schema selected", description: schema.name });
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
      if (!sid) throw new Error("No session_id returned from backend");
      store.setSessionId(sid);
      store.setSessionCreated(true);
      toast({ title: "Session created", description: `ID: ${sid.slice(0, 8)}…` });
    } catch (err: any) {
      toast({ title: "Session creation failed", description: err.message, variant: "destructive" });
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSelectExistingSession = (session: any) => {
    store.setSessionId(session.session_id);
    store.setSessionMode(session.mode || "auto");
    store.setSessionProvider(session.provider || "groq");
    store.setSessionCreated(true);
    toast({ title: "Session selected", description: session.session_id.slice(0, 8) + "…" });
  };

  const handleExtract = async () => {
    if (!store.selectedDocId || !store.sessionId) {
      toast({ title: "Missing required data", description: "Document and session are required", variant: "destructive" });
      return;
    }
    store.setExtracting(true);
    try {
      const schemaId = store.schemaId || undefined;
      const schemaDef = !schemaId && store.schemaDefinition ? store.schemaDefinition : undefined;
      const res = await api.runExtraction(store.sessionId, store.selectedDocId, schemaId, schemaDef);
      store.setExtractionResult(res.data || res);
      store.setStep(4);
      toast({ title: "Extraction complete" });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
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
      case 0: return store.uploadedDocs.length > 0 && !!store.selectedDocId;
      case 1: return store.schemaSource === "skip" || store.schemaValid;
      case 2: return store.sessionCreated && !!store.sessionId;
      case 3: return !!store.extractionResult;
      default: return true;
    }
  };

  const goNext = () => {
    if (canAdvance(store.currentStep)) store.setStep(store.currentStep + 1);
  };

  const needsProviderConfig = store.sessionMode === "ai" || store.sessionMode === "hybrid";

  return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-5xl mx-auto">
      <PageHeader title="Upload & Extract" subtitle="End-to-end document extraction pipeline" />

      {/* Stepper */}
      <div className="flex items-center justify-center gap-0 mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <button
              onClick={() => i <= store.currentStep && store.setStep(i)}
              disabled={i > store.currentStep + 1}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium tracking-wide transition-all rounded-lg ${
                i === store.currentStep
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : i < store.currentStep
                  ? "text-glow-success cursor-pointer hover:bg-glow-success/5"
                  : "text-muted-foreground/40 cursor-not-allowed"
              }`}
            >
              {i < store.currentStep ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-mono">{i + 1}</span>
              )}
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1 ${i < store.currentStep ? "bg-glow-success/30" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 0: Upload */}
        {store.currentStep === 0 && (
          <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <HUDFrame label="Document Intake">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`glass-card p-10 text-center border-2 border-dashed transition-all duration-300 ${
                  dragOver ? "border-primary/40 bg-primary/3" : "border-border"
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Processing upload…</p>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-display font-semibold text-foreground mb-1">Drop files here</h3>
                    <p className="text-muted-foreground text-sm mb-6">or choose an upload method below</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <label className="btn-primary cursor-pointer">
                        <FileUp className="w-4 h-4" /> Single File
                        <input type="file" className="hidden" onChange={e => handleUpload(e.target.files, "single")} />
                      </label>
                      <label className="btn-secondary cursor-pointer">
                        <Upload className="w-4 h-4" /> Batch Upload
                        <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, "batch")} />
                      </label>
                      <label className="btn-secondary cursor-pointer">
                        <FolderArchive className="w-4 h-4" /> ZIP Folder
                        <input type="file" accept=".zip" className="hidden" onChange={e => handleUpload(e.target.files, "zip")} />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </HUDFrame>

            {store.uploadedDocs.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {store.uploadedDocs.map((doc, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                      onClick={() => store.setSelectedDoc(doc.document_id)}
                      className={`glass-card p-4 cursor-pointer ${
                        store.selectedDocId === doc.document_id ? "border-primary/30 bg-primary/3" : ""
                      }`}
                    >
                      <p className="font-medium text-foreground text-sm truncate">{doc.filename || `Document ${i + 1}`}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">{doc.document_id}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={handleParse} disabled={!store.selectedDocId || parsing} className="btn-secondary disabled:opacity-40">
                    {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
                    Parse Document
                  </button>
                  {store.parsedContent && (
                    <button onClick={() => setShowParsedPreview(!showParsedPreview)} className="btn-secondary">
                      <Eye className="w-4 h-4" /> {showParsedPreview ? "Hide" : "Preview"}
                    </button>
                  )}
                </div>

                {showParsedPreview && store.parsedContent && (
                  <div className="glass-card p-4 max-h-60 overflow-auto">
                    <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(store.parsedContent, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex justify-end">
                  <button onClick={goNext} disabled={!canAdvance(0)} className="btn-primary">
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 1: Schema */}
        {store.currentStep === 1 && (
          <motion.div key="schema" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <HUDFrame label="Schema Configuration">
              <GlassCard>
                <h3 className="text-base font-display font-semibold text-foreground mb-5">Choose Schema Source</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                  {([
                    { id: "upload", label: "Upload JSON", icon: FileUp },
                    { id: "paste", label: "Paste JSON", icon: Code },
                    { id: "existing", label: "Select Existing", icon: List },
                    { id: "skip", label: "Skip / Auto", icon: SkipForward },
                  ] as { id: SchemaSource; label: string; icon: any }[]).map(opt => (
                    <button key={opt.id} onClick={() => { store.setSchemaSource(opt.id); if (opt.id === "skip") { store.setSchemaValid(false); store.setSchemaId(""); store.setSchemaDefinition(null); } }}
                      className={`p-3.5 rounded-lg text-center transition-all flex flex-col items-center gap-2 ${
                        store.schemaSource === opt.id
                          ? "bg-primary/8 text-primary border border-primary/20"
                          : "bg-secondary/50 text-muted-foreground border border-border hover:border-primary/15 hover:text-foreground"
                      }`}
                    >
                      <opt.icon className="w-4.5 h-4.5" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>

                {store.schemaSource === "upload" && (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs text-muted-foreground mb-1.5 block">Upload a .json schema file</span>
                      <input type="file" accept=".json"
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 file:cursor-pointer"
                        onChange={e => e.target.files?.[0] && handleSchemaUpload(e.target.files[0])} />
                    </label>
                    {store.schemaValid && store.schemaName && (
                      <div className="flex items-center gap-2 text-sm text-glow-success">
                        <CheckCircle2 className="w-4 h-4" /> {store.schemaName}
                      </div>
                    )}
                  </div>
                )}

                {store.schemaSource === "paste" && (
                  <div className="space-y-3">
                    <textarea value={schemaJsonInput} onChange={e => { setSchemaJsonInput(e.target.value); setSchemaJsonError(""); }}
                      rows={8} placeholder='{"field_name": "string", ...}'
                      className="input-refined resize-none" />
                    {schemaJsonError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4" /> {schemaJsonError}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <button onClick={handleSchemaPaste} className="btn-primary">Validate & Apply</button>
                      <button onClick={() => { try { setSchemaJsonInput(JSON.stringify(JSON.parse(schemaJsonInput), null, 2)); } catch {} }}
                        className="btn-secondary">Format JSON</button>
                    </div>
                    {store.schemaValid && store.schemaSource === "paste" && (
                      <div className="flex items-center gap-2 text-sm text-glow-success">
                        <CheckCircle2 className="w-4 h-4" /> Schema validated
                      </div>
                    )}
                  </div>
                )}

                {store.schemaSource === "existing" && (
                  <div className="space-y-3">
                    {loadingSchemas ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                      </div>
                    ) : existingSchemas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No schemas found.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-auto">
                        {existingSchemas.map((s: any) => (
                          <button key={s.schema_id} onClick={() => handleSelectExistingSchema(s)}
                            className={`p-3 rounded-lg text-left transition-all ${
                              store.schemaId === s.schema_id
                                ? "bg-primary/8 text-primary border border-primary/20"
                                : "bg-secondary/30 border border-border hover:border-primary/15"
                            }`}
                          >
                            <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{s.schema_id}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {store.schemaSource === "skip" && (
                  <p className="text-sm text-muted-foreground">No schema will be used. The backend will attempt auto-extraction.</p>
                )}

                {store.schemaValid && (
                  <div className="mt-5 p-3 rounded-lg bg-glow-success/5 border border-glow-success/15">
                    <div className="flex items-center gap-2 text-sm text-glow-success">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">Active:</span>
                      <span className="font-mono text-xs">{store.schemaName}</span>
                    </div>
                  </div>
                )}
              </GlassCard>
            </HUDFrame>

            <div className="mt-6 flex justify-end">
              <button onClick={goNext} disabled={!canAdvance(1)} className="btn-primary">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Session */}
        {store.currentStep === 2 && (
          <motion.div key="session" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <HUDFrame label="Session Configuration">
              <GlassCard>
                <h3 className="text-base font-display font-semibold text-foreground mb-5">Configure Session</h3>

                {existingSessions.length > 0 && !store.sessionCreated && (
                  <div className="mb-6">
                    <p className="text-xs text-muted-foreground mb-2">Existing Sessions</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-36 overflow-auto mb-4">
                      {existingSessions.map((s: any) => (
                        <button key={s.session_id} onClick={() => handleSelectExistingSession(s)}
                          className="p-3 rounded-lg text-left bg-secondary/30 border border-border hover:border-primary/15 transition-all">
                          <p className="text-xs font-mono text-foreground truncate">{s.session_id}</p>
                          <div className="flex gap-2 mt-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary font-mono">{s.mode}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/8 text-accent font-mono">{s.provider}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground">or create new</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  </div>
                )}

                {!store.sessionCreated ? (
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-2">Extraction Mode</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {MODES.map(m => (
                          <button key={m.id} onClick={() => store.setSessionMode(m.id)}
                            className={`p-3 rounded-lg text-center transition-all ${
                              store.sessionMode === m.id
                                ? "bg-primary/8 text-primary border border-primary/20"
                                : "bg-secondary/30 text-muted-foreground border border-border hover:border-primary/15 hover:text-foreground"
                            }`}
                          >
                            <m.icon className="w-4 h-4 mx-auto mb-1.5" />
                            <span className="text-xs font-medium block">{m.label}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {needsProviderConfig && (
                      <>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-2">AI Provider</label>
                          <div className="flex flex-wrap gap-2">
                            {PROVIDERS.map(p => (
                              <button key={p} onClick={() => store.setSessionProvider(p)}
                                className={`px-4 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                                  store.sessionProvider === p
                                    ? "bg-accent/10 text-accent border border-accent/20"
                                    : "bg-secondary/30 text-muted-foreground border border-border hover:border-accent/15"
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border">
                          <p className="text-xs text-muted-foreground font-medium">Provider Configuration</p>
                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">API Key</label>
                            <input type="password"
                              value={store.providerConfig.api_key || ""}
                              onChange={e => store.setProviderConfig({ ...store.providerConfig, api_key: e.target.value })}
                              placeholder="Enter API key"
                              className="input-refined" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] text-muted-foreground block mb-1">Model <span className="text-muted-foreground/50">(optional)</span></label>
                              <input value={store.providerConfig.model || ""}
                                onChange={e => store.setProviderConfig({ ...store.providerConfig, model: e.target.value })}
                                placeholder="e.g. gpt-4o"
                                className="input-refined" />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground block mb-1">Base URL <span className="text-muted-foreground/50">(optional)</span></label>
                              <input value={store.providerConfig.base_url || ""}
                                onChange={e => store.setProviderConfig({ ...store.providerConfig, base_url: e.target.value })}
                                placeholder="Custom endpoint"
                                className="input-refined" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <button onClick={handleCreateSession} disabled={creatingSession} className="btn-primary w-full justify-center">
                      {creatingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Initialize Session
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-glow-success/5 border border-glow-success/15">
                    <div className="flex items-center gap-2 text-glow-success mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-display font-semibold text-sm">Session Active</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>ID: <span className="font-mono text-foreground">{store.sessionId.slice(0, 12)}…</span></p>
                      <p>Mode: <span className="text-foreground">{store.sessionMode}</span> · Provider: <span className="text-foreground">{store.sessionProvider}</span></p>
                    </div>
                    <button onClick={() => { store.setSessionCreated(false); store.setSessionId(""); }}
                      className="mt-3 btn-secondary text-xs py-1.5 px-3">
                      <RotateCcw className="w-3 h-3" /> Change
                    </button>
                  </div>
                )}
              </GlassCard>
            </HUDFrame>

            <div className="mt-6 flex justify-end">
              <button onClick={goNext} disabled={!canAdvance(2)} className="btn-primary">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Extraction */}
        {store.currentStep === 3 && (
          <motion.div key="extract" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <HUDFrame label="Extraction">
              <GlassCard>
                <h3 className="text-base font-display font-semibold text-foreground mb-5">Review & Execute</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  {[
                    { label: "Document", value: store.uploadedDocs.find(d => d.document_id === store.selectedDocId)?.filename || store.selectedDocId.slice(0, 12) },
                    { label: "Schema", value: store.schemaName || "None (auto)" },
                    { label: "Session", value: `${store.sessionMode} / ${store.sessionProvider}` },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg bg-secondary/30 border border-border">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">{item.label}</p>
                      <p className="text-sm text-foreground font-mono truncate">{item.value}</p>
                    </div>
                  ))}
                </div>

                <button onClick={handleExtract} disabled={store.extracting} className="btn-primary w-full justify-center py-3.5">
                  {store.extracting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Extracting…</>
                  ) : (
                    <><Zap className="w-5 h-5" /> Execute Extraction</>
                  )}
                </button>
              </GlassCard>
            </HUDFrame>
          </motion.div>
        )}

        {/* Step 4: Results */}
        {store.currentStep === 4 && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <HUDFrame label="Results">
              <GlassCard>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-glow-success/8 border border-glow-success/15 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-glow-success" />
                  </div>
                  <div>
                    <h3 className="text-base font-display font-semibold text-foreground">Extraction Complete</h3>
                    <p className="text-xs text-muted-foreground">
                      {store.extractionResult?.engine && `Engine: ${store.extractionResult.engine}`}
                      {store.extractionResult?.status && ` · Status: ${store.extractionResult.status}`}
                    </p>
                  </div>
                </div>

                {store.extractionResult?.data && typeof store.extractionResult.data === "object" && (
                  <div className="mb-5">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Extracted Fields</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(store.extractionResult.data).map(([key, val]) => (
                        <div key={key} className="p-2.5 rounded-lg bg-secondary/30 border border-border">
                          <p className="text-[10px] text-muted-foreground uppercase">{key}</p>
                          <p className="text-sm text-foreground font-mono truncate">{typeof val === "object" ? JSON.stringify(val) : String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <details className="group mb-5">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1 mb-2 transition-colors">
                    <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" /> Raw Response
                  </summary>
                  <div className="glass-card p-4 max-h-72 overflow-auto">
                    <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(store.extractionResult, null, 2)}
                    </pre>
                  </div>
                </details>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(store.extractionResult, null, 2)], { type: "application/json" });
                      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                      a.download = `extraction_${store.selectedDocId}.json`; a.click();
                    }}
                    className="btn-primary">
                    <Download className="w-4 h-4" /> JSON
                  </button>
                  <button
                    onClick={() => {
                      try {
                        const data = store.extractionResult?.data || store.extractionResult;
                        const flat = typeof data === "object" && !Array.isArray(data) ? data : { result: JSON.stringify(data) };
                        const headers = Object.keys(flat);
                        const csv = [headers.join(","), headers.map(h => `"${String(flat[h] ?? "").replace(/"/g, '""')}"`).join(",")].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                        a.download = `extraction_${store.selectedDocId}.csv`; a.click();
                      } catch {}
                    }}
                    className="btn-secondary">
                    <Download className="w-4 h-4" /> CSV
                  </button>
                  <button onClick={() => store.resetWorkflow()} className="btn-secondary">
                    <RotateCcw className="w-4 h-4" /> New Extraction
                  </button>
                </div>
              </GlassCard>
            </HUDFrame>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
