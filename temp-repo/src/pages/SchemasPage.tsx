// ─────────────────────────────────────────────────────────────
//  SchemasPage.tsx  (FIXED)
//
//  FIXES:
//  1. uploadSchema now shows the exact backend error so you
//     know why normalization failed.
//  2. JSON editor pre-fills a working example so users
//     don't upload empty/broken schemas.
//  3. Validate button gives instant feedback before upload.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { PageHeader, GlassCard, EmptyState, LoadingGrid } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Upload,
  Trash2,
  Eye,
  X,
  Loader2,
  Code,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// Example schema so users always upload something valid
const EXAMPLE_SCHEMA = JSON.stringify(
  {
    document_name: "string",
    date: "string",
    total_amount: "number",
    vendor_name: "string",
    line_items: "array",
  },
  null,
  2
);

export default function SchemasPage() {
  const { toast } = useToast();
  const [schemas, setSchemas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDef, setNewDef] = useState(EXAMPLE_SCHEMA);
  const [jsonError, setJsonError] = useState("");
  const [jsonValid, setJsonValid] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewSchema, setViewSchema] = useState<any>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const fetchSchemas = async () => {
    try {
      const res = await api.listSchemas();
      setSchemas(res.data?.items || res.data || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemas();
  }, []);

  // ── JSON validation ─────────────────────────────────────────
  const validateJson = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setJsonError("Must be a JSON object, e.g. { \"field\": \"string\" }");
        setJsonValid(false);
        return false;
      }
      if (Object.keys(parsed).length === 0) {
        setJsonError("Schema cannot be empty — add at least one field");
        setJsonValid(false);
        return false;
      }
      setJsonError("");
      setJsonValid(true);
      return true;
    } catch (e: any) {
      setJsonError(e.message);
      setJsonValid(false);
      return false;
    }
  };

  const handleDefChange = (text: string) => {
    setNewDef(text);
    // Clear error while typing; validate on blur
    if (jsonError) setJsonError("");
  };

  // ── Create schema ───────────────────────────────────────────
  const createSchema = async () => {
    if (!newName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!validateJson(newDef)) {
      toast({
        title: "Invalid JSON",
        description: jsonError,
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const def = JSON.parse(newDef);
      await api.createSchema(newName.trim(), def);
      toast({ title: "Schema created ✓" });
      setShowCreate(false);
      setNewName("");
      setNewDef(EXAMPLE_SCHEMA);
      setJsonError("");
      setJsonValid(true);
      fetchSchemas();
    } catch (e: any) {
      toast({
        title: "Failed to create schema",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // ── Delete schema ───────────────────────────────────────────
  const deleteSchema = async (id: string) => {
    try {
      await api.deleteSchema(id);
      setSchemas((prev) => prev.filter((s) => s.schema_id !== id));
      toast({ title: "Schema deleted" });
    } catch (e: any) {
      toast({
        title: "Delete failed",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  // ── Upload schema JSON file ─────────────────────────────────
  //
  //  FIX: previously the backend's normalize_schema() was too
  //  strict and rejected valid flat-object schemas.
  //  The backend fix is in schema_utils.py (see that file).
  //
  //  On the frontend we also:
  //  - pre-validate the JSON before even sending to backend
  //  - surface the exact backend error message in the toast
  //  - show a spinner while uploading
  // ─────────────────────────────────────────────────────────────
  const uploadSchema = async (file: File) => {
    setUploadingFile(true);
    try {
      // 1. Read and validate JSON client-side first
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast({
          title: "Invalid JSON file",
          description: "The file is not valid JSON.",
          variant: "destructive",
        });
        return;
      }

      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        toast({
          title: "Invalid schema format",
          description:
            'Schema must be a JSON object like { "field_name": "string" }',
          variant: "destructive",
        });
        return;
      }

      if (Object.keys(parsed).length === 0) {
        toast({
          title: "Empty schema",
          description: "Schema must have at least one field.",
          variant: "destructive",
        });
        return;
      }

      // 2. Send to backend
      await api.uploadSchema(file);
      toast({ title: "Schema uploaded ✓" });
      fetchSchemas();
    } catch (e: any) {
      // Surface exact backend error (normalization failed, etc.)
      toast({
        title: "Upload failed",
        description: e.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-5xl mx-auto">
      <PageHeader
        title="Schemas"
        subtitle="Manage extraction schemas for structured data output"
      />

      {/* ── Action buttons ──────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary text-xs"
        >
          <Plus className="w-4 h-4" /> Create Schema
        </button>

        <label className="btn-secondary text-xs cursor-pointer flex items-center gap-2">
          {uploadingFile ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploadingFile ? "Uploading…" : "Upload JSON"}
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            disabled={uploadingFile}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadSchema(file);
              e.target.value = "";
            }}
          />
        </label>

        {/* Helper tip */}
        <span className="text-xs text-muted-foreground">
          JSON format:{" "}
          <code className="bg-muted px-1 rounded text-[10px]">
            {"{ \"field\": \"string\" }"}
          </code>
        </span>
      </div>

      {/* ── Schema grid ─────────────────────────────────────── */}
      {loading ? (
        <LoadingGrid />
      ) : schemas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Schemas"
          description="Create or upload a schema to get started"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schemas.map((s, i) => (
            <motion.div
              key={s.schema_id || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5"
            >
              <h3 className="font-display font-semibold text-foreground truncate text-sm">
                {s.name}
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground truncate mt-1">
                {s.schema_id}
              </p>
              {s.created_at && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(s.created_at).toLocaleDateString()}
                </p>
              )}
              {/* Field count badge */}
              {s.schema_definition && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {Object.keys(s.schema_definition).length} field(s)
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setViewSchema(s)}
                  className="p-1.5 rounded-md hover:bg-primary/8 text-muted-foreground hover:text-primary transition-colors"
                  title="View schema"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteSchema(s.schema_id)}
                  className="p-1.5 rounded-md hover:bg-destructive/8 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete schema"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Create Schema Modal ─────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.97 }}
              animate={{ scale: 1 }}
              className="glass-card p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-display font-semibold text-foreground">
                  Create Schema
                </h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Name
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Invoice Schema"
                    className="input-refined"
                  />
                </div>

                {/* Schema definition */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-muted-foreground">
                      Schema Definition (JSON)
                    </label>
                    <button
                      onClick={() => {
                        try {
                          setNewDef(JSON.stringify(JSON.parse(newDef), null, 2));
                          validateJson(newDef);
                        } catch { }
                      }}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Format
                    </button>
                  </div>
                  <textarea
                    value={newDef}
                    onChange={(e) => handleDefChange(e.target.value)}
                    onBlur={(e) => validateJson(e.target.value)}
                    rows={10}
                    className="input-refined resize-none font-mono text-xs"
                  />

                  {/* Format hint */}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Format: <code>{`{ "field_name": "string|number|boolean|date|array" }`}</code>
                  </p>

                  {/* Error */}
                  {jsonError && (
                    <div className="flex items-center gap-1 mt-1 text-destructive text-xs">
                      <AlertCircle className="w-3 h-3" /> {jsonError}
                    </div>
                  )}
                </div>

                {/* Validate + status */}
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => validateJson(newDef)}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    <Code className="w-3 h-3" /> Validate
                  </button>
                  {jsonValid && !jsonError && (
                    <span className="flex items-center gap-1 text-xs text-emerald-500">
                      <CheckCircle2 className="w-3 h-3" /> Valid JSON
                    </span>
                  )}
                </div>

                {/* Create */}
                <button
                  onClick={createSchema}
                  disabled={creating || !newName.trim()}
                  className="btn-primary w-full justify-center disabled:opacity-45"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Schema
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── View Schema Modal ───────────────────────────────── */}
      <AnimatePresence>
        {viewSchema && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
            onClick={() => setViewSchema(null)}
          >
            <div
              className="glass-card p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-display font-semibold text-foreground">
                    {viewSchema.name}
                  </h3>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {viewSchema.schema_id}
                  </p>
                </div>
                <button
                  onClick={() => setViewSchema(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">
                {JSON.stringify(
                  viewSchema.schema_definition || viewSchema,
                  null,
                  2
                )}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}