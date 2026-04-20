import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, CheckCircle2, Trash2, Upload, Download,
  Loader2, Search, Edit3, Save, X, ChevronDown, ChevronRight,
  FileJson, RefreshCw, AlertCircle, Shield, Clock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AliasMeta {
  count: number;
  best_confidence: number;
  sources: Record<string, number>;
  approved: boolean;
}
interface AliasField { [label: string]: AliasMeta; }
interface AliasData { version: number; fields: Record<string, AliasField>; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function confPct(c: number) { return Math.round(Math.min(c ?? 0, 1) * 100); }

function pillClass(approved: boolean, conf: number) {
  if (approved) return { bg: "hsl(148 58% 40% / 0.1)", border: "hsl(148 58% 40% / 0.22)", color: "hsl(148 58% 55%)" };
  if (conf >= 0.7) return { bg: "hsl(34 82% 46% / 0.1)", border: "hsl(34 82% 46% / 0.22)", color: "hsl(34 82% 60%)" };
  return { bg: "hsl(220 26% 12%)", border: "hsl(220 24% 18%)", color: "hsl(215 12% 50%)" };
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AliasesPage() {
  const { toast } = useToast();

  // Data
  const [data, setData] = useState<AliasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI
  const [view, setView] = useState<"fields" | "json">("fields");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // JSON editor
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonDirty, setJsonDirty] = useState(false);

  // Add form
  const [newField, setNewField] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [adding, setAdding] = useState(false);

  // Inline edit
  const [editing, setEditing] = useState<{ field: string; alias: string } | null>(null);
  const [editVal, setEditVal] = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAliases();
      const raw = res.data || res;
      if (raw && typeof raw === "object" && "fields" in raw) {
        const d = raw as AliasData;
        setData(d);
        setJsonText(JSON.stringify(d, null, 2));
      } else {
        const fallback: AliasData = { version: 1, fields: {} };
        setData(fallback);
        setJsonText(JSON.stringify(fallback, null, 2));
      }
    } catch (e: any) {
      toast({ title: "Failed to load aliases", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── JSON save ──────────────────────────────────────────────────────────────
  const saveJson = async () => {
    let parsed: any;
    try { parsed = JSON.parse(jsonText); setJsonError(""); }
    catch (e: any) { setJsonError("Invalid JSON: " + e.message); return; }
    setSaving(true);
    try {
      const file = new File([JSON.stringify(parsed)], "alias_memory.json", { type: "application/json" });
      await api.uploadAliasFile(file, false);
      await fetchData();
      setJsonDirty(false);
      toast({ title: "Alias file saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Add alias ──────────────────────────────────────────────────────────────
  const addAlias = async () => {
    if (!newField.trim() || !newAlias.trim()) return;
    setAdding(true);
    try {
      await api.addAlias({ field_name: newField.trim(), alias: newAlias.trim(), approved: true });
      toast({ title: "Alias added" });
      setNewField(""); setNewAlias("");
      await fetchData();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setAdding(false); }
  };

  const approveAlias = async (field: string, alias: string) => {
    try {
      await api.approveAlias({ field_name: field, alias });
      toast({ title: "Approved" });
      await fetchData();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  const removeAlias = async (field: string, alias: string) => {
    try {
      await api.removeAlias({ field_name: field, alias });
      toast({ title: "Removed" });
      await fetchData();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  const saveEdit = async () => {
    if (!editing || !editVal.trim()) return;
    try {
      await api.removeAlias({ field_name: editing.field, alias: editing.alias });
      await api.addAlias({ field_name: editing.field, alias: editVal.trim(), approved: true });
      toast({ title: "Alias updated" });
      setEditing(null);
      await fetchData();
    } catch (e: any) { toast({ title: "Update failed", description: e.message, variant: "destructive" }); }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const download = () => {
    const b = new Blob([jsonText], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b);
    a.download = "alias_memory.json"; a.click();
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    try {
      const text = await file.text();
      JSON.parse(text);
      await api.uploadAliasFile(file, false);
      toast({ title: "File uploaded" });
      await fetchData();
    } catch (e: any) { toast({ title: "Upload failed", description: e.message, variant: "destructive" }); }
  };

  // ── Expand helpers ─────────────────────────────────────────────────────────
  const toggle = (name: string) => setExpanded(p => {
    const n = new Set(p);
    n.has(name) ? n.delete(name) : n.add(name);
    return n;
  });
  const expandAll = () => data && setExpanded(new Set(Object.keys(data.fields)));
  const collapseAll = () => setExpanded(new Set());

  // ── Filtered fields ────────────────────────────────────────────────────────
  const filtered = data
    ? Object.entries(data.fields).filter(([name, aliases]) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return name.includes(q) || Object.keys(aliases).some(a => a.includes(q));
    })
    : [];

  const totalAliases = data ? Object.values(data.fields).reduce((s, f) => s + Object.keys(f).length, 0) : 0;
  const approvedCount = data ? Object.values(data.fields).reduce((s, f) => s + Object.values(f).filter(m => m.approved).length, 0) : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative z-10 pt-[52px] min-h-screen">
      <div className="max-w-5xl mx-auto px-5 py-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse-glow" />
            <span className="section-label">Field Intelligence</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-display font-bold text-gradient-glow tracking-tight">Alias Registry</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage field aliases for intelligent document extraction matching</p>
            </div>
          </div>
          <div className="divider mt-4" />
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Fields", value: data ? Object.keys(data.fields).length : 0, color: "text-primary" },
            { label: "Aliases", value: totalAliases, color: "text-accent" },
            { label: "Approved", value: approvedCount, color: "text-emerald-400" },
            { label: "Pending", value: totalAliases - approvedCount, color: "text-amber-400" },
          ].map(s => (
            <div key={s.label} className="glass-robot p-3.5 text-center robot-corner">
              <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Add Alias */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono tracking-[0.22em] uppercase px-2 py-0.5 rounded-md"
              style={{ color: "hsl(185 72% 44% / 0.7)", background: "hsl(185 72% 44% / 0.06)", border: "1px solid hsl(185 72% 44% / 0.12)" }}>
              Add New Alias
            </span>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(220 24% 16% / 0.8), transparent)" }} />
          </div>
          <div className="glass-robot robot-corner p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="section-label block mb-1.5">Field Name</label>
                <input value={newField} onChange={e => setNewField(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addAlias()}
                  placeholder="e.g. minimumcircuitamps_mca"
                  list="field-autocomplete"
                  className="input-base" />
                <datalist id="field-autocomplete">
                  {data && Object.keys(data.fields).map(f => <option key={f} value={f} />)}
                </datalist>
              </div>
              <div className="flex-1">
                <label className="section-label block mb-1.5">Alias Label</label>
                <input value={newAlias} onChange={e => setNewAlias(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addAlias()}
                  placeholder="e.g. MCA, Min Circuit Amps"
                  className="input-base" />
              </div>
              <button onClick={addAlias} disabled={adding || !newField.trim() || !newAlias.trim()}
                className="btn btn-primary glow-primary whitespace-nowrap">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Alias
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* View toggle */}
          <div className="flex items-center p-0.5 rounded-lg gap-0.5"
            style={{ background: "hsl(220 40% 7%)", border: "1px solid hsl(220 24% 13%)" }}>
            {([
              { v: "fields", icon: BookOpen, label: "Fields" },
              { v: "json", icon: FileJson, label: "JSON Editor" },
            ] as const).map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => { setView(v); if (v === "json" && data) setJsonText(JSON.stringify(data, null, 2)); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Search */}
          {view === "fields" && (
            <div className="flex items-center gap-2 flex-1 min-w-[180px] px-3 py-1.5 rounded-lg"
              style={{ background: "hsl(220 40% 7%)", border: "1px solid hsl(220 24% 13%)" }}>
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search fields or aliases…"
                className="bg-transparent text-sm text-foreground font-mono w-full focus:outline-none placeholder:text-muted-foreground/40" />
              {search && <button onClick={() => setSearch("")}><X className="w-3 h-3 text-muted-foreground" /></button>}
            </div>
          )}

          {view === "fields" && (
            <>
              <button onClick={expandAll} className="text-xs font-mono text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg glass-robot">Expand All</button>
              <button onClick={collapseAll} className="text-xs font-mono text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg glass-robot">Collapse All</button>
            </>
          )}
          <button onClick={fetchData} className="btn btn-ghost btn-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={download} className="btn btn-ghost btn-sm"><Download className="w-3.5 h-3.5" /> Download</button>
          <label className="btn btn-ghost btn-sm cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
          </label>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">

            {/* ── JSON EDITOR ────────────────────────────────────── */}
            {view === "json" && (
              <motion.div key="json" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-mono tracking-[0.22em] uppercase px-2 py-0.5 rounded-md"
                    style={{ color: "hsl(185 72% 44% / 0.7)", background: "hsl(185 72% 44% / 0.06)", border: "1px solid hsl(185 72% 44% / 0.12)" }}>
                    Alias File Editor
                  </span>
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(220 24% 16% / 0.8), transparent)" }} />
                </div>

                <div className="glass-robot robot-corner overflow-hidden">
                  {/* Editor header */}
                  <div className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderBottom: "1px solid hsl(220 24% 13%)", background: "hsl(220 45% 4% / 0.6)" }}>
                    <div className="flex items-center gap-2.5">
                      <FileJson className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-mono text-muted-foreground">alias_memory.json</span>
                      {jsonDirty && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                          style={{ background: "hsl(34 82% 46% / 0.1)", color: "hsl(34 82% 60%)", border: "1px solid hsl(34 82% 46% / 0.2)" }}>
                          unsaved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Format button */}
                      <button
                        onClick={() => { try { setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2)); setJsonError(""); } catch (e: any) { setJsonError(e.message); } }}
                        className="text-xs font-mono text-muted-foreground hover:text-foreground px-2.5 py-1 rounded glass-robot">
                        Format
                      </button>
                      {/* Revert */}
                      <button onClick={() => { if (data) { setJsonText(JSON.stringify(data, null, 2)); setJsonDirty(false); setJsonError(""); } }}
                        className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded glass-robot">
                        <RefreshCw className="w-3 h-3" /> Revert
                      </button>
                      {/* Save */}
                      <button onClick={saveJson} disabled={saving || !!jsonError}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40 glow-primary">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                      </button>
                    </div>
                  </div>

                  {/* Error bar */}
                  {jsonError && (
                    <div className="flex items-center gap-2 px-4 py-2 text-xs font-mono text-red-400"
                      style={{ background: "hsl(0 62% 46% / 0.08)", borderBottom: "1px solid hsl(0 62% 46% / 0.18)" }}>
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {jsonError}
                    </div>
                  )}

                  {/* Dark textarea — key fix */}
                  <textarea
                    value={jsonText}
                    onChange={e => {
                      setJsonText(e.target.value);
                      setJsonDirty(true);
                      try { JSON.parse(e.target.value); setJsonError(""); }
                      catch (err: any) { setJsonError(err.message); }
                    }}
                    spellCheck={false}
                    className="w-full h-[520px] resize-none focus:outline-none text-xs leading-relaxed p-4"
                    style={{
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      background: "hsl(220 45% 3%)",       /* ← dark, matches theme */
                      color: "hsl(215 20% 80%)",
                      border: "none",
                      display: "block",
                    }}
                  />

                  {/* Footer */}
                  <div className="flex items-center justify-between px-4 py-2 text-[10px] font-mono text-muted-foreground"
                    style={{ borderTop: "1px solid hsl(220 24% 11%)", background: "hsl(220 45% 4% / 0.5)" }}>
                    <span>{jsonText.split("\n").length} lines · {jsonText.length.toLocaleString()} chars</span>
                    <span className={jsonError ? "text-red-400" : "text-emerald-400"}>
                      {jsonError ? "⚠ Invalid JSON" : "✓ Valid JSON"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── FIELDS BROWSER ──────────────────────────────────── */}
            {view === "fields" && (
              <motion.div key="fields" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-mono tracking-[0.22em] uppercase px-2 py-0.5 rounded-md"
                    style={{ color: "hsl(185 72% 44% / 0.7)", background: "hsl(185 72% 44% / 0.06)", border: "1px solid hsl(185 72% 44% / 0.12)" }}>
                    Alias Database
                  </span>
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(220 24% 16% / 0.8), transparent)" }} />
                  <span className="text-[10px] font-mono text-muted-foreground">{filtered.length} fields</span>
                </div>

                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="w-10 h-10 text-primary/20 mb-3" />
                    <p className="text-sm text-muted-foreground">{search ? "No fields match your search" : "No aliases found"}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filtered.map(([fieldName, aliases], idx) => {
                      const entries = Object.entries(aliases);
                      const approved = entries.filter(([, m]) => m.approved);
                      const pending = entries.filter(([, m]) => !m.approved);
                      const isOpen = expanded.has(fieldName);

                      return (
                        <motion.div key={fieldName}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.012 }}
                          className="overflow-hidden rounded-xl"
                          style={{ border: "1px solid hsl(220 24% 13%)" }}>

                          {/* Field header — click to toggle */}
                          <button onClick={() => toggle(fieldName)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
                            style={{ background: "hsl(220 40% 7%)" }}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="transition-transform duration-200 text-muted-foreground flex-shrink-0"
                                style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                              <span className="text-sm font-mono font-semibold text-foreground truncate">{fieldName}</span>
                              <span className="pill-info text-[9px] flex-shrink-0">{entries.length}</span>
                              {approved.length > 0 && (
                                <span className="pill-success text-[9px] flex-shrink-0">{approved.length} ✓</span>
                              )}
                              {pending.length > 0 && (
                                <span className="pill-warning text-[9px] flex-shrink-0">{pending.length} ⏳</span>
                              )}
                            </div>

                            {/* Preview when collapsed */}
                            {!isOpen && (
                              <div className="hidden md:flex items-center gap-1 mr-2 flex-shrink-0">
                                {entries.slice(0, 4).map(([al]) => (
                                  <span key={al} className="text-[9px] px-1.5 py-0.5 rounded font-mono text-muted-foreground"
                                    style={{ background: "hsl(220 26% 11%)", border: "1px solid hsl(220 24% 16%)" }}>
                                    {al}
                                  </span>
                                ))}
                                {entries.length > 4 && (
                                  <span className="text-[9px] text-muted-foreground font-mono">+{entries.length - 4}</span>
                                )}
                              </div>
                            )}
                          </button>

                          {/* Expanded content */}
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                style={{ borderTop: "1px solid hsl(220 24% 11%)", background: "hsl(220 45% 5%)" }}>
                                <div className="p-4 space-y-4">

                                  {/* Approved section */}
                                  {approved.length > 0 && (
                                    <div>
                                      <div className="flex items-center gap-1.5 mb-2">
                                        <Shield className="w-3 h-3 text-emerald-400" />
                                        <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400">
                                          Approved ({approved.length})
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                        {approved.map(([al, meta]) => (
                                          <AliasChip key={al} alias={al} meta={meta} fieldName={fieldName}
                                            isEditing={editing?.field === fieldName && editing?.alias === al}
                                            editVal={editVal}
                                            onEdit={() => { setEditing({ field: fieldName, alias: al }); setEditVal(al); }}
                                            onEditChange={setEditVal} onEditSave={saveEdit}
                                            onEditCancel={() => setEditing(null)}
                                            onApprove={() => approveAlias(fieldName, al)}
                                            onRemove={() => removeAlias(fieldName, al)}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Pending section */}
                                  {pending.length > 0 && (
                                    <div>
                                      <div className="flex items-center gap-1.5 mb-2">
                                        <Clock className="w-3 h-3 text-amber-400" />
                                        <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400">
                                          Pending ({pending.length})
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                        {pending.map(([al, meta]) => (
                                          <AliasChip key={al} alias={al} meta={meta} fieldName={fieldName}
                                            isEditing={editing?.field === fieldName && editing?.alias === al}
                                            editVal={editVal}
                                            onEdit={() => { setEditing({ field: fieldName, alias: al }); setEditVal(al); }}
                                            onEditChange={setEditVal} onEditSave={saveEdit}
                                            onEditCancel={() => setEditing(null)}
                                            onApprove={() => approveAlias(fieldName, al)}
                                            onRemove={() => removeAlias(fieldName, al)}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Quick add to this field */}
                                  <QuickAdd fieldName={fieldName} onAdd={async (al) => {
                                    await api.addAlias({ field_name: fieldName, alias: al, approved: true });
                                    await fetchData();
                                  }} />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ── Alias Chip ─────────────────────────────────────────────────────────────────
function AliasChip({
  alias, meta, fieldName,
  isEditing, editVal,
  onEdit, onEditChange, onEditSave, onEditCancel,
  onApprove, onRemove,
}: {
  alias: string; meta: AliasMeta; fieldName: string;
  isEditing: boolean; editVal: string;
  onEdit: () => void; onEditChange: (v: string) => void;
  onEditSave: () => void; onEditCancel: () => void;
  onApprove: () => void; onRemove: () => void;
}) {
  const conf = meta.best_confidence ?? 0;
  const p = pillClass(meta.approved, conf);

  if (isEditing) {
    return (
      <div className="p-2.5 rounded-lg" style={{ background: p.bg, border: `1px solid ${p.border}` }}>
        <input value={editVal} onChange={e => onEditChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onEditSave(); if (e.key === "Escape") onEditCancel(); }}
          autoFocus
          className="w-full bg-transparent text-xs font-mono text-foreground focus:outline-none border-b pb-1 mb-2"
          style={{ borderColor: p.border }} />
        <div className="flex gap-1.5">
          <button onClick={onEditSave} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-primary text-primary-foreground">
            <Save className="w-2.5 h-2.5" /> Save
          </button>
          <button onClick={onEditCancel} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono glass-robot text-muted-foreground">
            <X className="w-2.5 h-2.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2.5 rounded-lg group" style={{ background: p.bg, border: `1px solid ${p.border}` }}>
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-xs font-mono break-all leading-tight flex-1" style={{ color: p.color }}>{alias}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onEdit} title="Edit" className="p-0.5 rounded hover:bg-white/10"><Edit3 className="w-3 h-3" style={{ color: p.color }} /></button>
          {!meta.approved && (
            <button onClick={onApprove} title="Approve" className="p-0.5 rounded hover:bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-3 h-3" /></button>
          )}
          <button onClick={onRemove} title="Remove" className="p-0.5 rounded hover:bg-red-500/20 text-red-400"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: `${p.color}22` }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${confPct(conf)}%`, background: p.color }} />
        </div>
        <span className="text-[9px] font-mono opacity-60" style={{ color: p.color }}>{confPct(conf)}%</span>
      </div>

      {/* Sources */}
      <div className="mt-1 text-[9px] font-mono opacity-50" style={{ color: p.color }}>
        ×{meta.count}
        {meta.sources && Object.entries(meta.sources).slice(0, 2).map(([s, c]) => ` · ${s}:${c}`)}
      </div>
    </div>
  );
}

// ── Quick Add ─────────────────────────────────────────────────────────────────
function QuickAdd({ fieldName, onAdd }: { fieldName: string; onAdd: (alias: string) => Promise<void> }) {
  const [show, setShow] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (!val.trim()) return;
    setBusy(true);
    try { await onAdd(val.trim()); setVal(""); setShow(false); }
    catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  if (!show) {
    return (
      <button onClick={() => setShow(true)}
        className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors">
        <Plus className="w-3 h-3" /> Add alias to {fieldName}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setShow(false); }}
        placeholder="New alias label…" autoFocus
        className="input-base flex-1 text-xs py-1.5" />
      <button onClick={submit} disabled={busy || !val.trim()} className="btn btn-primary btn-sm">
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
      </button>
      <button onClick={() => { setShow(false); setVal(""); }} className="btn btn-ghost btn-sm">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}