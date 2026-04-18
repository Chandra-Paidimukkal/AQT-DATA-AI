import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { PageHeader, GlassCard, EmptyState, LoadingGrid, HUDFrame } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import { Settings, Cpu, Zap, Brain, Workflow, Trash2, Plus, Loader2, X } from "lucide-react";

const MODES = [
  { id: "auto", label: "Auto", icon: Zap, desc: "Automatically select best engine" },
  { id: "python", label: "Python", icon: Cpu, desc: "Python-based extraction" },
  { id: "ai", label: "AI", icon: Brain, desc: "AI model extraction" },
  { id: "hybrid", label: "Hybrid", icon: Workflow, desc: "Combined engines" },
];

const PROVIDERS = ["groq", "openai", "gemini", "landingai", "ollama"];

export default function SessionsPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    mode: "auto", provider: "groq", api_key: "", model: "", base_url: "",
  });

  const fetchSessions = async () => {
    try {
      const res = await api.listSessions();
      setSessions(res.data?.items || res.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSessions(); }, []);

  const needsProvider = form.mode === "ai" || form.mode === "hybrid";

  const createSession = async () => {
    setCreating(true);
    try {
      const payload: any = { mode: form.mode, provider: needsProvider ? form.provider : "none" };
      if (needsProvider) {
        const config: any = {};
        if (form.api_key) config.api_key = form.api_key;
        if (form.model) config.model = form.model;
        if (form.base_url) config.base_url = form.base_url;
        if (Object.keys(config).length > 0) payload.provider_config = config;
      }
      const res = await api.createSession(payload);
      const session = res.data || res;
      toast({ title: "Session created", description: `ID: ${(session.session_id || session.id || "").slice(0, 8)}…` });
      setShowCreate(false);
      setForm({ mode: "auto", provider: "groq", api_key: "", model: "", base_url: "" });
      fetchSessions();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const deleteSession = async (id: string) => {
    try {
      await api.deleteSession(id);
      setSessions(prev => prev.filter(s => s.session_id !== id));
      toast({ title: "Session deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-5xl mx-auto">
      <PageHeader title="Sessions" subtitle="Configure AI engines and extraction sessions" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {MODES.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-card p-5 text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-3">
              <m.icon className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-foreground text-sm">{m.label}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">{m.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs">
          <Plus className="w-4 h-4" /> New Session
        </button>
      </div>

      {loading ? <LoadingGrid /> : sessions.length === 0 ? (
        <EmptyState icon={Settings} title="No Sessions" description="Create a session to configure extraction" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((s, i) => (
            <motion.div key={s.session_id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5">
              <h3 className="font-mono text-foreground truncate text-sm">{s.session_id}</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/8 text-primary font-mono">{s.mode}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-accent/8 text-accent font-mono">{s.provider}</span>
              </div>
              <div className="mt-3">
                <button onClick={() => deleteSession(s.session_id)}
                  className="p-1.5 rounded-md hover:bg-destructive/8 text-muted-foreground hover:text-destructive transition-colors">
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
                <h3 className="text-base font-display font-semibold text-foreground">Create Session</h3>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-2">Mode</label>
                  <div className="grid grid-cols-4 gap-2">
                    {MODES.map(m => (
                      <button key={m.id} onClick={() => setForm(f => ({ ...f, mode: m.id }))}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          form.mode === m.id ? "bg-primary/8 text-primary border border-primary/20" : "bg-secondary/30 text-muted-foreground border border-border hover:border-primary/15"
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {needsProvider && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-2">Provider</label>
                      <div className="flex flex-wrap gap-2">
                        {PROVIDERS.map(p => (
                          <button key={p} onClick={() => setForm(f => ({ ...f, provider: p }))}
                            className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                              form.provider === p ? "bg-accent/8 text-accent border border-accent/20" : "bg-secondary/30 text-muted-foreground border border-border hover:border-accent/15"
                            }`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">API Key</label>
                      <input type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                        placeholder="Provider API key" className="input-refined" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1.5">Model <span className="text-muted-foreground/50">(opt)</span></label>
                        <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                          placeholder="e.g. gpt-4o" className="input-refined" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1.5">Base URL <span className="text-muted-foreground/50">(opt)</span></label>
                        <input value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))}
                          placeholder="Custom endpoint" className="input-refined" />
                      </div>
                    </div>
                  </>
                )}

                <button onClick={createSession} disabled={creating}
                  className="btn-primary w-full justify-center disabled:opacity-45">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Initialize Session
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
