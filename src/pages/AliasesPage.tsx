import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { PageHeader, EmptyState, LoadingGrid, HUDFrame, GlassCard } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, CheckCircle2, Trash2, Upload, Download,
  Loader2, FileText, Save, RotateCcw, Eye, EyeOff, X
} from "lucide-react";

export default function AliasesPage() {
  const { toast } = useToast();
  const [aliases, setAliases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [field, setField] = useState("");
  const [alias, setAlias] = useState("");
  const [adding, setAdding] = useState(false);

  // File editor state
  const [fileContent, setFileContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [fileError, setFileError] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const fetchAliases = async () => {
    try {
      const res = await api.listAliases();
      const data = res.data || res;
      setAliases(
        Array.isArray(data)
          ? data
          : Object.entries(data).map(([k, v]) => ({
            field_name: k,
            ...(typeof v === "object" ? v : { aliases: v }),
          }))
      );
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchAliases(); }, []);

  const addAlias = async () => {
    if (!field || !alias) return;
    setAdding(true);
    try {
      await api.addAlias({ field_name: field, alias });
      toast({ title: "Alias added" });
      setField("");
      setAlias("");
      fetchAliases();
    } catch (e: any) {
      toast({ title: "Failed to add alias", description: e.message, variant: "destructive" });
    } finally { setAdding(false); }
  };

  const approveAlias = async (fieldName: string, aliasVal: string) => {
    try {
      await api.approveAlias({ field_name: fieldName, alias: aliasVal });
      toast({ title: "Alias approved" });
      fetchAliases();
    } catch (e: any) {
      toast({ title: "Approve failed", description: e.message, variant: "destructive" });
    }
  };

  const removeAlias = async (fieldName: string, aliasVal: string) => {
    try {
      await api.removeAlias({ field_name: fieldName, alias: aliasVal });
      toast({ title: "Alias removed" });
      fetchAliases();
    } catch (e: any) {
      toast({ title: "Remove failed", description: e.message, variant: "destructive" });
    }
  };

  const downloadFile = async () => {
    try {
      const res = await api.downloadAliasFile();
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "aliases.json";
      a.click();
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const uploadFile = async (file: File) => {
    try {
      await api.uploadAliasFile(file);
      toast({ title: "Alias file uploaded" });
      fetchAliases();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };

  // Load file content for inline editor
  const loadFileContent = async () => {
    setFileLoading(true);
    setFileError("");
    try {
      const res = await api.downloadAliasFile();
      const text = await res.text();
      try {
        const formatted = JSON.stringify(JSON.parse(text), null, 2);
        setFileContent(formatted);
        setEditedContent(formatted);
      } catch {
        setFileContent(text);
        setEditedContent(text);
      }
      setFileOpen(true);
      setHasChanges(false);
    } catch (e: any) {
      toast({ title: "Failed to load file", description: e.message, variant: "destructive" });
    } finally { setFileLoading(false); }
  };

  const handleEditorChange = (val: string) => {
    setEditedContent(val);
    setHasChanges(val !== fileContent);
    try {
      JSON.parse(val);
      setFileError("");
    } catch (e: any) {
      setFileError(e.message);
    }
  };

  const saveFileContent = async () => {
    if (fileError) {
      toast({ title: "Fix JSON errors before saving", variant: "destructive" });
      return;
    }
    setFileSaving(true);
    try {
      const blob = new Blob([editedContent], { type: "application/json" });
      const file = new File([blob], "aliases.json", { type: "application/json" });
      await api.uploadAliasFile(file, false);
      setFileContent(editedContent);
      setHasChanges(false);
      toast({ title: "File saved successfully" });
      fetchAliases();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setFileSaving(false); }
  };

  const formatJson = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(editedContent), null, 2);
      setEditedContent(formatted);
      setHasChanges(formatted !== fileContent);
      setFileError("");
    } catch { }
  };

  const revertChanges = () => {
    setEditedContent(fileContent);
    setHasChanges(false);
    setFileError("");
  };

  return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-6xl mx-auto">
      <PageHeader title="Alias Registry" subtitle="Manage field aliases for intelligent field matching" />

      {/* Add Alias Form */}
      <HUDFrame label="Add New Alias" className="mb-8">
        <GlassCard className="!p-5">
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="text-xs text-muted-foreground block mb-1.5">Field Name</label>
              <input
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="e.g. invoice_number"
                className="input-refined font-mono"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs text-muted-foreground block mb-1.5">Alias</label>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="e.g. inv_no"
                className="input-refined font-mono"
              />
            </div>
            <button
              onClick={addAlias}
              disabled={adding || !field || !alias}
              className="btn-primary whitespace-nowrap"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Alias
            </button>
          </div>
        </GlassCard>
      </HUDFrame>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button onClick={downloadFile} className="btn-secondary text-xs">
          <Download className="w-4 h-4" /> Download
        </button>
        <label className="btn-secondary text-xs cursor-pointer">
          <Upload className="w-4 h-4" /> Upload
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
          />
        </label>
        <button
          onClick={loadFileContent}
          disabled={fileLoading}
          className="btn-secondary text-xs"
        >
          {fileLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : fileOpen ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {fileOpen ? "Close Editor" : "View & Edit File"}
        </button>
      </div>

      {/* Inline File Editor */}
      <AnimatePresence>
        {fileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <HUDFrame label="Alias File Editor">
              <GlassCard className="!p-0 overflow-hidden">
                {/* Editor toolbar */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-xs font-mono text-foreground">aliases.json</span>
                    {hasChanges && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-glow-warning/10 text-glow-warning border border-glow-warning/20">
                        Modified
                      </span>
                    )}
                    {fileError && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                        Invalid JSON
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={formatJson} className="btn-ghost text-xs py-1 px-2">Format</button>
                    <button onClick={revertChanges} disabled={!hasChanges} className="btn-ghost text-xs py-1 px-2 disabled:opacity-30">
                      <RotateCcw className="w-3 h-3" /> Revert
                    </button>
                    <button
                      onClick={saveFileContent}
                      disabled={fileSaving || !hasChanges || !!fileError}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      {fileSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </button>
                    <button onClick={() => setFileOpen(false)} className="btn-ghost text-xs py-1 px-2">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Editor area */}
                <div className="relative">
                  <textarea
                    value={editedContent}
                    onChange={(e) => handleEditorChange(e.target.value)}
                    className="code-editor w-full min-h-[400px] p-4 border-0 rounded-none"
                    spellCheck={false}
                  />
                </div>

                {fileError && (
                  <div className="px-4 py-2 border-t border-destructive/20 bg-destructive/5 text-xs text-destructive font-mono">
                    {fileError}
                  </div>
                )}
              </GlassCard>
            </HUDFrame>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aliases List */}
      {loading ? (
        <LoadingGrid />
      ) : aliases.length === 0 ? (
        <EmptyState icon={BookOpen} title="No Aliases" description="Add aliases to improve field matching accuracy" />
      ) : (
        <HUDFrame label="Alias Database">
          <div className="space-y-2.5">
            {aliases.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card p-4"
              >
                <h3 className="font-display font-semibold text-foreground text-sm">{a.field_name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  {(Array.isArray(a.aliases) ? a.aliases : []).map((al: string, j: number) => (
                    <div
                      key={j}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 border border-border text-xs font-mono text-muted-foreground"
                    >
                      {al}
                      <button
                        onClick={() => approveAlias(a.field_name, al)}
                        className="text-glow-success/60 hover:text-glow-success transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeAlias(a.field_name, al)}
                        className="text-destructive/60 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </HUDFrame>
      )}
    </div>
  );
}