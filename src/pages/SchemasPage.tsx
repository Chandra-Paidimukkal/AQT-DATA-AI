import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { PageHeader, GlassCard, EmptyState, LoadingGrid, HUDFrame } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Upload, Trash2, Eye, X, Loader2, Code, CheckCircle2, AlertCircle } from "lucide-react";

export default function SchemasPage() {
  const { toast } = useToast();
  const [schemas, setSchemas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDef, setNewDef] = useState("{}");
  const [jsonError, setJsonError] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewSchema, setViewSchema] = useState<any>(null);

  const fetchSchemas = async () => {
    try {
      const res = await api.listSchemas();
      setSchemas(res.data?.items || res.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSchemas(); }, []);

  const validateJson = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null) {
        setJsonError("Must be a JSON object");
        return false;
      }
      setJsonError("");
      return true;
    } catch (e: any) {
      setJsonError(e.message);
      return false;
    }
  };

  const createSchema = async () => {
    if (!newName) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!validateJson(newDef)) { toast({ title: "Invalid JSON", description: jsonError, variant: "destructive" }); return; }
    setCreating(true);
    try {
      const def = JSON.parse(newDef);
      await api.createSchema(newName, def);
      toast({ title: "Schema created" });
      setShowCreate(false);
      setNewName(""); setNewDef("{}"); setJsonError("");
      fetchSchemas();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const deleteSchema = async (id: string) => {
    try {
      await api.deleteSchema(id);
      setSchemas(prev => prev.filter(s => s.schema_id !== id));
      toast({ title: "Schema deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const uploadSchema = async (file: File) => {
    try {
      const text = await file.text();
      try { JSON.parse(text); } catch { toast({ title: "Invalid JSON file", variant: "destructive" }); return; }
      await api.uploadSchema(file);
      toast({ title: "Schema uploaded" });
      fetchSchemas();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-5xl mx-auto">
      <PageHeader title="Schemas" subtitle="Manage extraction schemas for structured data output" />

      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs">
          <Plus className="w-4 h-4" /> Create Schema
        </button>
        <label className="btn-secondary text-xs cursor-pointer">
          <Upload className="w-4 h-4" /> Upload JSON
          <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && uploadSchema(e.target.files[0])} />
        </label>
      </div>

      {loading ? <LoadingGrid /> : schemas.length === 0 ? (
        <EmptyState icon={FileText} title="No Schemas" description="Create or upload a schema to get started" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schemas.map((s, i) => (
            <motion.div key={s.schema_id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card p-5">
              <h3 className="font-display font-semibold text-foreground truncate text-sm">{s.name}</h3>
              <p className="text-[10px] font-mono text-muted-foreground truncate mt-1">{s.schema_id}</p>
              {s.created_at && <p className="text-[10px] text-muted-foreground mt-1">{new Date(s.created_at).toLocaleDateString()}</p>}
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => setViewSchema(s)} className="p-1.5 rounded-md hover:bg-primary/8 text-muted-foreground hover:text-primary transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => deleteSchema(s.schema_id)} className="p-1.5 rounded-md hover:bg-destructive/8 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }} className="glass-card p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-display font-semibold text-foreground">Create Schema</h3>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Name</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Invoice Schema" className="input-refined" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-muted-foreground">Schema Definition (JSON)</label>
                    <button onClick={() => { try { setNewDef(JSON.stringify(JSON.parse(newDef), null, 2)); } catch {} }}
                      className="text-[10px] text-primary hover:underline">Format</button>
                  </div>
                  <textarea value={newDef} onChange={e => { setNewDef(e.target.value); setJsonError(""); }} rows={8}
                    className="input-refined resize-none" />
                  {jsonError && (
                    <div className="flex items-center gap-1 mt-1 text-destructive text-xs">
                      <AlertCircle className="w-3 h-3" /> {jsonError}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={() => validateJson(newDef)} className="btn-secondary text-xs py-1.5 px-3">
                    <Code className="w-3 h-3" /> Validate
                  </button>
                  {!jsonError && newDef !== "{}" && (
                    <span className="flex items-center gap-1 text-glow-success text-xs"><CheckCircle2 className="w-3 h-3" /> Valid</span>
                  )}
                </div>
                <button onClick={createSchema} disabled={creating || !newName}
                  className="btn-primary w-full justify-center disabled:opacity-45">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewSchema && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6" onClick={() => setViewSchema(null)}>
            <div className="glass-card p-6 max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-display font-semibold text-foreground">{viewSchema.name}</h3>
                <button onClick={() => setViewSchema(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(viewSchema.schema_definition || viewSchema, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
