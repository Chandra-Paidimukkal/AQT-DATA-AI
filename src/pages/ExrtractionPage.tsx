import { useState, useCallback, useRef } from "react";
import { FileText, Upload, FolderArchive, DownloadCloud, Loader2, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Trash2, FileJson } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface UploadedDocument {
    id: string;
    name: string;
    size: number;
    file: File;
}

interface ParsedTable {
    headers: string[];
    rows: string[][];
}

interface ParseResult {
    documentText: string;
    tables: ParsedTable[];
    charCount: number;
    rawJson: string;
}

type DocStatus = "idle" | "parsing" | "done" | "error";

interface DocState {
    doc: UploadedDocument;
    status: DocStatus;
    result?: ParseResult;
    errorMsg?: string;
}

type UploadMode = "single" | "batch" | "zip";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function generateId() {
    return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * Simulate document parsing — replace this with your real API call.
 * e.g. call your backend: POST /api/parse with FormData containing the file.
 */
async function parseDocumentAPI(doc: UploadedDocument): Promise<ParseResult> {
    // ── Replace with real API call ──────────────────────────────────────────
    // const formData = new FormData();
    // formData.append("file", doc.file);
    // const res = await fetch("/api/parse", { method: "POST", body: formData });
    // const data = await res.json();
    // return data;
    // ────────────────────────────────────────────────────────────────────────

    // Simulated delay (remove once real API is wired)
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

    const mockTables: ParsedTable[] = Array.from({ length: Math.floor(Math.random() * 4) + 1 }, (_, ti) => ({
        headers: [`Column A${ti + 1}`, `Column B${ti + 1}`, `Column C${ti + 1}`],
        rows: Array.from({ length: 3 }, (_, ri) => [`Row${ri + 1}A`, `Row${ri + 1}B`, `Row${ri + 1}C`]),
    }));

    const text = `Extracted text from "${doc.name}".\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;
    const rawJson = JSON.stringify({ documentText: text, tables: mockTables }, null, 2);

    return { documentText: text, tables: mockTables, charCount: rawJson.length, rawJson };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function Extract() {
    const [uploadMode, setUploadMode] = useState<UploadMode>("batch");
    const [docStates, setDocStates] = useState<DocState[]>([]);
    const [isParsingAll, setIsParsingAll] = useState(false);
    const [parsedCount, setParsedCount] = useState(0);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const zipInputRef = useRef<HTMLInputElement>(null);

    // ── File ingestion ──────────────────────────────────────────────────────
    const addFiles = useCallback((files: File[]) => {
        const allowed = ["application/pdf", "image/png", "image/jpeg", "image/tiff", "image/jpg"];
        const valid = files.filter((f) => allowed.includes(f.type) || f.name.match(/\.(pdf|png|jpg|jpeg|tiff)$/i));
        if (!valid.length) return;

        const newStates: DocState[] = valid.map((f) => ({
            doc: { id: generateId(), name: f.name, size: f.size, file: f },
            status: "idle",
        }));

        setDocStates((prev) => {
            const updated = [...prev, ...newStates];
            if (!selectedDocId && updated.length > 0) setSelectedDocId(updated[0].doc.id);
            return updated;
        });
    }, [selectedDocId]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) addFiles(Array.from(e.target.files));
        e.target.value = "";
    };

    const handleZipInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        // For a real ZIP: use JSZip or send to backend to extract and return files
        // Here we just add the ZIP itself as a single entry for demo
        addFiles([file]);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
    }, [addFiles]);

    const removeDoc = (id: string) => {
        setDocStates((prev) => {
            const next = prev.filter((s) => s.doc.id !== id);
            if (selectedDocId === id) setSelectedDocId(next[0]?.doc.id ?? null);
            return next;
        });
    };

    const clearAll = () => {
        setDocStates([]);
        setSelectedDocId(null);
        setParsedCount(0);
    };

    // ── Parse all ───────────────────────────────────────────────────────────
    const handleParseAll = async () => {
        const toParse = docStates.filter((s) => s.status === "idle" || s.status === "error");
        if (!toParse.length) return;

        setIsParsingAll(true);
        setParsedCount(0);
        let done = 0;

        for (const ds of toParse) {
            // Mark as parsing
            setDocStates((prev) =>
                prev.map((s) => (s.doc.id === ds.doc.id ? { ...s, status: "parsing" } : s))
            );

            try {
                const result = await parseDocumentAPI(ds.doc);
                setDocStates((prev) =>
                    prev.map((s) => (s.doc.id === ds.doc.id ? { ...s, status: "done", result } : s))
                );
            } catch (err) {
                setDocStates((prev) =>
                    prev.map((s) =>
                        s.doc.id === ds.doc.id ? { ...s, status: "error", errorMsg: String(err) } : s
                    )
                );
            }

            done++;
            setParsedCount(done);
        }

        setIsParsingAll(false);
        // Auto-select first done doc for preview
        setDocStates((prev) => {
            const first = prev.find((s) => s.status === "done");
            if (first) setSelectedDocId(first.doc.id);
            return prev;
        });
    };

    // ── Export all results ──────────────────────────────────────────────────
    const handleExportAll = () => {
        const results = docStates
            .filter((s) => s.status === "done" && s.result)
            .map((s) => ({
                documentId: s.doc.id,
                filename: s.doc.name,
                charCount: s.result!.charCount,
                tableCount: s.result!.tables.length,
                documentText: s.result!.documentText,
                tables: s.result!.tables,
            }));

        const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch_extraction_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportSingle = (ds: DocState) => {
        if (!ds.result) return;
        const blob = new Blob([ds.result.rawJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${ds.doc.name.replace(/\.[^.]+$/, "")}_parsed.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Derived ─────────────────────────────────────────────────────────────
    const totalDocs = docStates.length;
    const doneDocs = docStates.filter((s) => s.status === "done").length;
    const errorDocs = docStates.filter((s) => s.status === "error").length;
    const pendingDocs = docStates.filter((s) => s.status === "idle" || s.status === "error").length;
    const selectedState = docStates.find((s) => s.doc.id === selectedDocId);
    const canParseAll = pendingDocs > 0 && !isParsingAll;
    const canExportAll = doneDocs > 0 && !isParsingAll;

    // ── Status badge ────────────────────────────────────────────────────────
    const StatusBadge = ({ status }: { status: DocStatus }) => {
        if (status === "idle") return <span style={badge("neutral")}><Clock size={10} /> Queued</span>;
        if (status === "parsing") return <span style={badge("blue")}><Loader2 size={10} className="spin" /> Parsing</span>;
        if (status === "done") return <span style={badge("green")}><CheckCircle2 size={10} /> Done</span>;
        return <span style={badge("red")}><XCircle size={10} /> Error</span>;
    };

    return (
        <div style={styles.page}>
            {/* ── Upload Mode Tabs ─────────────────────────────── */}
            <div style={styles.tabRow}>
                {(["single", "batch", "zip"] as UploadMode[]).map((m) => (
                    <button
                        key={m}
                        onClick={() => setUploadMode(m)}
                        style={{ ...styles.tab, ...(uploadMode === m ? styles.tabActive : {}) }}
                    >
                        {m === "single" && <FileText size={14} />}
                        {m === "batch" && <Upload size={14} />}
                        {m === "zip" && <FolderArchive size={14} />}
                        {m === "single" ? "Single File" : m === "batch" ? "Batch Upload" : "ZIP Folder"}
                    </button>
                ))}
            </div>

            {/* ── Drop Zone ────────────────────────────────────── */}
            <div
                style={{ ...styles.dropzone, ...(isDragging ? styles.dropzoneActive : {}) }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
            >
                <div style={styles.dropIcon}>
                    <Upload size={28} color="#22d3ee" />
                </div>
                <p style={styles.dropTitle}>Drop files here</p>
                <p style={styles.dropSub}>or choose an upload method below</p>
                <p style={styles.dropHint}>PDF, PNG, JPG, JPEG, TIFF</p>
                <div style={styles.dropButtons}>
                    {uploadMode !== "zip" ? (
                        <>
                            <button style={styles.btnPrimary} onClick={() => fileInputRef.current?.click()}>
                                <Upload size={14} /> Choose Files
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple={uploadMode === "batch"}
                                accept=".pdf,.png,.jpg,.jpeg,.tiff"
                                style={{ display: "none" }}
                                onChange={handleFileInput}
                            />
                        </>
                    ) : (
                        <>
                            <button style={styles.btnPrimary} onClick={() => zipInputRef.current?.click()}>
                                <FolderArchive size={14} /> Choose ZIP
                            </button>
                            <input
                                ref={zipInputRef}
                                type="file"
                                accept=".zip"
                                style={{ display: "none" }}
                                onChange={handleZipInput}
                            />
                        </>
                    )}
                    <button style={styles.btnSecondary} onClick={() => fileInputRef.current?.click()}>
                        <FileText size={14} /> Single File
                    </button>
                </div>
            </div>

            {/* ── Documents List ───────────────────────────────── */}
            {totalDocs > 0 && (
                <>
                    <div style={styles.docsHeader}>
                        <span style={styles.docsLabel}>
                            UPLOADED DOCUMENTS ({totalDocs})
                            {doneDocs > 0 && <span style={styles.pill("green")}>{doneDocs} parsed</span>}
                            {errorDocs > 0 && <span style={styles.pill("red")}>{errorDocs} failed</span>}
                            {isParsingAll && <span style={styles.pill("blue")}>Parsing {parsedCount}/{pendingDocs + parsedCount}…</span>}
                        </span>
                        <button style={styles.btnGhost} onClick={clearAll} title="Clear all">
                            <Trash2 size={13} /> Clear All
                        </button>
                    </div>

                    <div style={styles.docGrid}>
                        {docStates.map((ds) => (
                            <div
                                key={ds.doc.id}
                                style={{
                                    ...styles.docCard,
                                    ...(selectedDocId === ds.doc.id ? styles.docCardSelected : {}),
                                    ...(ds.status === "parsing" ? styles.docCardParsing : {}),
                                }}
                                onClick={() => setSelectedDocId(ds.doc.id)}
                            >
                                <div style={styles.docIcon}>
                                    <FileJson size={18} color="#22d3ee" />
                                </div>
                                <div style={styles.docInfo}>
                                    <p style={styles.docName} title={ds.doc.name}>{ds.doc.name}</p>
                                    <p style={styles.docMeta}>{formatBytes(ds.doc.size)}</p>
                                </div>
                                <div style={styles.docActions}>
                                    <StatusBadge status={ds.status} />
                                    {ds.status === "done" && (
                                        <button
                                            style={styles.iconBtn}
                                            title="Export this doc"
                                            onClick={(e) => { e.stopPropagation(); handleExportSingle(ds); }}
                                        >
                                            <DownloadCloud size={14} color="#22d3ee" />
                                        </button>
                                    )}
                                    <button
                                        style={styles.iconBtn}
                                        title="Remove"
                                        onClick={(e) => { e.stopPropagation(); removeDoc(ds.doc.id); }}
                                    >
                                        <XCircle size={14} color="#6b7280" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Action Bar ────────────────────────────────── */}
                    <div style={styles.actionBar}>
                        <button
                            style={{ ...styles.btnPrimary, ...(canParseAll ? {} : styles.btnDisabled) }}
                            disabled={!canParseAll}
                            onClick={handleParseAll}
                        >
                            {isParsingAll
                                ? <><Loader2 size={14} className="spin" /> Parsing {parsedCount} / {pendingDocs + parsedCount}…</>
                                : <><FileText size={14} /> Parse All Documents ({pendingDocs})</>}
                        </button>

                        {canExportAll && (
                            <button style={styles.btnExport} onClick={handleExportAll}>
                                <DownloadCloud size={14} /> Export All Results ({doneDocs})
                            </button>
                        )}

                        <button
                            style={styles.btnSecondary}
                            onClick={() => setShowPreview((p) => !p)}
                        >
                            {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {showPreview ? "Hide Preview" : "Show Preview"}
                        </button>
                    </div>

                    {/* ── Preview Panel ─────────────────────────────── */}
                    {showPreview && selectedState && (
                        <div style={styles.preview}>
                            <div style={styles.previewHeader}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <FileJson size={14} color="#22d3ee" />
                                    <span style={{ color: "#9ca3af", fontSize: 13 }}>
                                        {selectedState.doc.name}
                                    </span>
                                    {selectedState.result && (
                                        <>
                                            <span style={badge("neutral")}>{selectedState.result.charCount.toLocaleString()} chars</span>
                                            <span style={badge("blue")}>{selectedState.result.tables.length} tables</span>
                                        </>
                                    )}
                                </div>
                                {selectedState.status === "done" && (
                                    <button style={styles.btnExport} onClick={() => handleExportSingle(selectedState)}>
                                        <DownloadCloud size={13} /> Export
                                    </button>
                                )}
                            </div>

                            {selectedState.status === "idle" && (
                                <p style={styles.previewPlaceholder}>Click "Parse All Documents" to extract this file.</p>
                            )}
                            {selectedState.status === "parsing" && (
                                <div style={styles.previewPlaceholder}>
                                    <Loader2 size={20} color="#22d3ee" className="spin" />
                                    <span>Parsing document…</span>
                                </div>
                            )}
                            {selectedState.status === "error" && (
                                <p style={{ ...styles.previewPlaceholder, color: "#f87171" }}>
                                    ✗ Error: {selectedState.errorMsg ?? "Unknown error"}
                                </p>
                            )}
                            {selectedState.status === "done" && selectedState.result && (
                                <div>
                                    <p style={styles.sectionLabel}>DOCUMENT TEXT</p>
                                    <pre style={styles.previewText}>{selectedState.result.documentText}</pre>

                                    {selectedState.result.tables.map((tbl, ti) => (
                                        <div key={ti} style={{ marginTop: 20 }}>
                                            <p style={styles.sectionLabel}>TABLE {ti + 1}</p>
                                            <div style={{ overflowX: "auto" }}>
                                                <table style={styles.table}>
                                                    <thead>
                                                        <tr>
                                                            {tbl.headers.map((h, hi) => (
                                                                <th key={hi} style={styles.th}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {tbl.rows.map((row, ri) => (
                                                            <tr key={ri}>
                                                                {row.map((cell, ci) => (
                                                                    <td key={ci} style={styles.td}>{cell}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Spinner animation */}
            <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const C = {
    bg: "#0d1117",
    surface: "#161b22",
    border: "#21262d",
    borderActive: "#22d3ee",
    text: "#e6edf3",
    muted: "#8b949e",
    accent: "#22d3ee",
    accentBg: "rgba(34,211,238,0.08)",
    danger: "#f87171",
    green: "#34d399",
    blue: "#60a5fa",
};

const styles: Record<string, React.CSSProperties> = {
    page: {
        background: C.bg,
        minHeight: "100vh",
        padding: "24px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        color: C.text,
    },
    tabRow: {
        display: "flex",
        gap: 4,
        marginBottom: 20,
        background: C.surface,
        borderRadius: 8,
        padding: 4,
        width: "fit-content",
        border: `1px solid ${C.border}`,
    },
    tab: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 16px",
        borderRadius: 6,
        border: "none",
        background: "transparent",
        color: C.muted,
        cursor: "pointer",
        fontSize: 13,
        transition: "all 0.15s",
    },
    tabActive: {
        background: C.accentBg,
        color: C.accent,
        border: `1px solid ${C.border}`,
    },
    dropzone: {
        border: `1.5px dashed ${C.border}`,
        borderRadius: 12,
        padding: "40px 24px",
        textAlign: "center",
        marginBottom: 24,
        transition: "all 0.2s",
        background: C.surface,
    },
    dropzoneActive: {
        borderColor: C.accent,
        background: C.accentBg,
    },
    dropIcon: {
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "rgba(34,211,238,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 16px",
    },
    dropTitle: { fontSize: 16, fontWeight: 600, margin: "0 0 4px", color: C.text },
    dropSub: { fontSize: 13, color: C.muted, margin: "0 0 4px" },
    dropHint: { fontSize: 11, color: "#4b5563", margin: "0 0 20px", letterSpacing: "0.05em" },
    dropButtons: { display: "flex", justifyContent: "center", gap: 12 },
    btnPrimary: {
        display: "flex", alignItems: "center", gap: 7,
        padding: "9px 20px", borderRadius: 7, border: "none",
        background: C.accent, color: "#000", fontWeight: 700,
        fontSize: 13, cursor: "pointer", transition: "opacity 0.15s",
        fontFamily: "inherit",
    },
    btnSecondary: {
        display: "flex", alignItems: "center", gap: 7,
        padding: "9px 20px", borderRadius: 7,
        border: `1px solid ${C.border}`,
        background: C.surface, color: C.text,
        fontSize: 13, cursor: "pointer", transition: "all 0.15s",
        fontFamily: "inherit",
    },
    btnExport: {
        display: "flex", alignItems: "center", gap: 7,
        padding: "9px 18px", borderRadius: 7,
        border: `1px solid ${C.accent}`,
        background: C.accentBg, color: C.accent,
        fontSize: 13, cursor: "pointer", fontFamily: "inherit",
        fontWeight: 600,
    },
    btnGhost: {
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 6, border: "none",
        background: "transparent", color: C.muted,
        fontSize: 12, cursor: "pointer", fontFamily: "inherit",
    },
    btnDisabled: { opacity: 0.45, cursor: "not-allowed" },
    iconBtn: {
        background: "transparent", border: "none",
        cursor: "pointer", padding: 4, borderRadius: 4,
        display: "flex", alignItems: "center",
    },
    docsHeader: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 12,
    },
    docsLabel: {
        fontSize: 11, letterSpacing: "0.1em", color: C.muted,
        display: "flex", alignItems: "center", gap: 8,
    },
    docGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 10,
        marginBottom: 16,
    },
    docCard: {
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", borderRadius: 9,
        background: C.surface, border: `1px solid ${C.border}`,
        cursor: "pointer", transition: "all 0.15s",
    },
    docCardSelected: {
        borderColor: C.accent,
        background: "rgba(34,211,238,0.06)",
    },
    docCardParsing: {
        borderColor: "#60a5fa",
        background: "rgba(96,165,250,0.05)",
    },
    docIcon: {
        width: 36, height: 36, borderRadius: 8,
        background: "rgba(34,211,238,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
    },
    docInfo: { flex: 1, minWidth: 0 },
    docName: {
        fontSize: 12, fontWeight: 500, margin: 0,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        color: C.text,
    },
    docMeta: { fontSize: 11, color: C.muted, margin: "2px 0 0" },
    docActions: {
        display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
    },
    actionBar: {
        display: "flex", gap: 10, alignItems: "center",
        marginBottom: 16, flexWrap: "wrap",
    },
    preview: {
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 20,
    },
    previewHeader: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16,
        borderBottom: `1px solid ${C.border}`, paddingBottom: 12,
    },
    previewPlaceholder: {
        color: C.muted, fontSize: 13, textAlign: "center",
        padding: "32px 0", display: "flex",
        alignItems: "center", justifyContent: "center", gap: 10,
    },
    previewText: {
        color: C.muted, fontSize: 12, lineHeight: 1.7,
        background: "#0d1117", padding: 16, borderRadius: 7,
        border: `1px solid ${C.border}`,
        whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
    },
    sectionLabel: {
        fontSize: 10, letterSpacing: "0.1em",
        color: C.accent, margin: "0 0 8px",
    },
    table: {
        width: "100%", borderCollapse: "collapse", fontSize: 12,
    },
    th: {
        background: "#0d1117", color: C.muted,
        padding: "8px 12px", textAlign: "left",
        borderBottom: `1px solid ${C.border}`,
        fontWeight: 600,
    },
    td: {
        padding: "7px 12px", color: C.text,
        borderBottom: `1px solid ${C.border}`,
    },
};

// Pill helper
styles["pill"] = () => ({});
const pill = (color: "green" | "red" | "blue" | "neutral") => ({
    display: "inline-flex", alignItems: "center",
    padding: "2px 8px", borderRadius: 20,
    fontSize: 10, fontWeight: 600, marginLeft: 6,
    background: color === "green" ? "rgba(52,211,153,0.12)"
        : color === "red" ? "rgba(248,113,113,0.12)"
            : color === "blue" ? "rgba(96,165,250,0.12)"
                : "rgba(139,148,158,0.12)",
    color: color === "green" ? C.green
        : color === "red" ? C.danger
            : color === "blue" ? C.blue
                : C.muted,
    border: `1px solid ${color === "green" ? "rgba(52,211,153,0.3)"
            : color === "red" ? "rgba(248,113,113,0.3)"
                : color === "blue" ? "rgba(96,165,250,0.3)"
                    : "rgba(139,148,158,0.2)"
        }`,
} as React.CSSProperties);

// Override styles.pill as a function reference for JSX
(styles as any).pill = pill;

// Badge helper (inline)
function badge(color: "green" | "red" | "blue" | "neutral") {
    return {
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 600,
        background: color === "green" ? "rgba(52,211,153,0.12)"
            : color === "red" ? "rgba(248,113,113,0.12)"
                : color === "blue" ? "rgba(96,165,250,0.12)"
                    : "rgba(139,148,158,0.1)",
        color: color === "green" ? "#34d399"
            : color === "red" ? "#f87171"
                : color === "blue" ? "#60a5fa"
                    : "#8b949e",
        border: `1px solid ${color === "green" ? "rgba(52,211,153,0.25)"
                : color === "red" ? "rgba(248,113,113,0.25)"
                    : color === "blue" ? "rgba(96,165,250,0.25)"
                        : "rgba(139,148,158,0.15)"
            }`,
    } as React.CSSProperties;
}