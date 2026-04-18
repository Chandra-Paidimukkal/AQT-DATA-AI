import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api";
import { PageHeader, EmptyState, LoadingGrid, HUDFrame, GlassCard, RoboticDivider } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import {
  FolderDown, Download, FileText, Database, Archive,
  Eye, X, Loader2, Save, RotateCcw
} from "lucide-react";

interface FileSection {
  title: string;
  icon: any;
  files: any[];
  loading: boolean;
  getUrl: (fn: string) => string;
  fetchContent?: (fn: string) => Promise<string>;
}

export default function FilesPage() {
  const { toast } = useToast();
  const [schemaFiles, setSchemaFiles] = useState<any[]>([]);
  const [resultFiles, setResultFiles] = useState<any[]>([]);
  const [exportFiles, setExportFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState({ schemas: true, results: true, exports: true });

  // File viewer/editor state
  const [viewingFile, setViewingFile] = useState<{ name: string; section: string } | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const load = async (fn: () => Promise<any>, setter: any, key: string) => {
      try {
        const res = await fn();
        const data = res.data || res;
        setter(Array.isArray(data) ? data : []);
      } catch {} finally {
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    };
    load(api.listSchemaFiles, setSchemaFiles, "schemas");
    load(api.listResultFiles, setResultFiles, "results");
    load(api.listExports, setExportFiles, "exports");
  }, []);

  const sections: FileSection[] = [
    { title: "Schema Files", icon: FileText, files: schemaFiles, loading: loading.schemas, getUrl: api.downloadSchemaFile },
    { title: "Result Files", icon: Database, files: resultFiles, loading: loading.results, getUrl: api.downloadResultFile },
    { title: "Export Files", icon: Archive, files: exportFiles, loading: loading.exports, getUrl: api.downloadExport },
  ];

  const openFileViewer = async (filename: string, section: string, getUrl: (fn: string) => string) => {
    setViewingFile({ name: filename, section });
    setFileLoading(true);
    try {
      const res = await fetch(getUrl(filename));
      const text = await res.text();
      try {
        const formatted = JSON.stringify(JSON.parse(text), null, 2);
        setFileContent(formatted);
        setEditedContent(formatted);
      } catch {
        setFileContent(text);
        setEditedContent(text);
      }
      setHasChanges(false);
    } catch (e: any) {
      setFileContent("Failed to load file content");
      setEditedContent("");
      toast({ title: "Failed to load file", description: e.message, variant: "destructive" });
    } finally { setFileLoading(false); }
  };

  const closeViewer = () => {
    setViewingFile(null);
    setFileContent("");
    setEditedContent("");
    setHasChanges(false);
  };

  const handleClose = () => {
    if (hasChanges && !confirm("Discard unsaved changes?")) return;
    closeViewer();
  };

  const saveFileContent = async () => {
    if (!viewingFile) return;
    if (viewingFile.name.endsWith(".json")) {
      try { JSON.parse(editedContent); }
      catch (e: any) {
        toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
        return;
      }
    }
    setFileLoading(true);
    try {
      const saver =
        viewingFile.section === "Schema Files" ? api.saveSchemaFile :
        viewingFile.section === "Result Files" ? api.saveResultFile :
        api.saveExportFile;
      await saver(viewingFile.name, editedContent);
      setFileContent(editedContent);
      setHasChanges(false);
      toast({ title: "Saved", description: `${viewingFile.name} updated` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setFileLoading(false); }
  };

  return (
    <div className="relative z-10 pt-24 pb-16 px-6 max-w-6xl mx-auto">
      <PageHeader title="Files & Downloads" subtitle="Access all generated files, exports, and results" />

      <div className="flex items-center gap-3 mb-8">
        <a
          href={api.aliasMemoryFile()}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary text-xs"
        >
          <Download className="w-4 h-4" /> Alias Memory File
        </a>
      </div>

      <div className="space-y-10">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <section.icon className="w-4 h-4 text-primary" /> {section.title}
            </h2>
            {section.loading ? (
              <LoadingGrid count={3} />
            ) : section.files.length === 0 ? (
              <EmptyState icon={FolderDown} title={`No ${section.title}`} description="Files will appear here when generated" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.files.map((f, i) => {
                  const filename = typeof f === "string" ? f : f.filename || f.name || `file_${i}`;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="glass-card p-4 flex items-center justify-between"
                    >
                      <p className="text-xs font-mono text-foreground truncate flex-1">{filename}</p>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => openFileViewer(filename, section.title, section.getUrl)}
                          className="p-2 rounded-lg hover:bg-primary/8 text-muted-foreground hover:text-primary transition-colors"
                          title="View file"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={section.getUrl(filename)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg hover:bg-primary/8 text-muted-foreground hover:text-primary transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            <RoboticDivider />
          </div>
        ))}
      </div>

      {/* File Viewer Modal */}
      <AnimatePresence>
        {viewingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm p-6"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="glass-card max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-secondary/20">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-mono text-foreground">{viewingFile.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                    {viewingFile.section}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <button
                      onClick={saveFileContent}
                      disabled={fileLoading}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                  )}
                  <a
                    href={sections.find((s) => s.title === viewingFile.section)?.getUrl(viewingFile.name)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost text-xs py-1 px-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                  <button onClick={handleClose} className="btn-ghost py-1 px-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto">
                {fileLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : (
                  <textarea
                    value={editedContent}
                    onChange={(e) => {
                      setEditedContent(e.target.value);
                      setHasChanges(e.target.value !== fileContent);
                    }}
                    className="code-editor w-full min-h-[60vh] p-5 border-0 rounded-none bg-transparent"
                    spellCheck={false}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}