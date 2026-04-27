// ─────────────────────────────────────────────────────────────
//  ExrtractionPage.tsx  (FIXED)
//
//  FIXES:
//  1. Wired to useDocumentQueue store — "Parse All" scrapes ALL
//     uploaded documents, not just the selected one.
//  2. Preview panel background is transparent (no white box).
//  3. Batch + ZIP uploads register all files in the queue.
// ─────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
    FileText,
    DownloadCloud,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    ChevronDown,
    ChevronUp,
    Trash2,
    FileJson,
    Zap,
    AlertCircle,
    RotateCcw,
} from "lucide-react";
import { useDocumentQueue } from "@/store/useDocumentQueue";
import { DropZone } from "@/components/DropZone";
import { DocumentQueueTable } from "@/components/DocumentQueueTable";
import { ScrapeAllButton } from "@/components/ScrapeAllButton";
import { api } from "@/services/api";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function ExrtractionPage() {
    const {
        documents,
        isScraping,
        scrapeProgress,
        scrapeAll,
        removeDocument,
        retryScrape,
        clearQueue,
    } = useDocumentQueue();

    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(true);

    // ── Derived ─────────────────────────────────────────────────
    const totalDocs = documents.length;
    const doneDocs = documents.filter((d) => d.scrape_status === "completed").length;
    const failedDocs = documents.filter((d) => d.scrape_status === "failed").length;
    const pendingDocs = documents.filter(
        (d) =>
            d.upload_status === "success" &&
            (d.scrape_status === "not_started" || d.scrape_status === "failed")
    ).length;

    const selectedDoc = documents.find((d) => d.client_id === selectedDocId);

    // Auto-select first completed doc when none selected
    React.useEffect(() => {
        if (!selectedDocId && documents.length > 0) {
            setSelectedDocId(documents[0].client_id);
        }
    }, [documents.length]);

    // ── Export all results ──────────────────────────────────────
    const handleExportAll = () => {
        const results = documents
            .filter((d) => d.scrape_status === "completed" && d.result)
            .map((d) => ({
                document_id: d.document_id,
                filename: d.filename,
                result: d.result,
            }));

        const blob = new Blob([JSON.stringify(results, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch_extraction_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportSingle = (doc: (typeof documents)[0]) => {
        if (!doc.result) return;
        const blob = new Blob([JSON.stringify(doc.result, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doc.filename.replace(/\.[^.]+$/, "")}_extracted.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={styles.page}>
            {/* ── Header ────────────────────────────────────────── */}
            <div style={styles.header}>
                <p style={styles.headerSub}>AGENTIC EXTRACTION PIPELINE</p>
                <h1 style={styles.headerTitle}>Upload &amp; Extract</h1>
                <p style={styles.headerDesc}>
                    End-to-end document data extraction in 5 steps
                </p>
            </div>

            {/* ── Steps indicator ──────────────────────────────── */}
            <div style={styles.stepsRow}>
                {["Upload", "Schema", "Session", "Extraction", "Results"].map(
                    (step, i) => (
                        <span
                            key={step}
                            style={{
                                ...styles.step,
                                ...(i === 0 ? styles.stepActive : {}),
                            }}
                        >
                            {i + 1} {step}
                        </span>
                    )
                )}
            </div>

            {/* ── Drop Zone ────────────────────────────────────── */}
            <div style={styles.sectionLabel}>DOCUMENT INTAKE</div>
            <DropZone />

            {/* ── Documents Queue ──────────────────────────────── */}
            {totalDocs > 0 && (
                <>
                    <div style={styles.docsHeader}>
                        <span style={styles.docsLabel}>
                            UPLOADED DOCUMENTS ({totalDocs})
                            {doneDocs > 0 && (
                                <span style={pill("green")}>{doneDocs} parsed</span>
                            )}
                            {failedDocs > 0 && (
                                <span style={pill("red")}>{failedDocs} failed</span>
                            )}
                            {isScraping && (
                                <span style={pill("blue")}>
                                    Scraping {scrapeProgress.done}/{scrapeProgress.total}…
                                </span>
                            )}
                        </span>
                        <button style={styles.btnGhost} onClick={clearQueue}>
                            <Trash2 size={13} /> Clear All
                        </button>
                    </div>

                    {/* Document cards grid */}
                    <div style={styles.docGrid}>
                        {documents.map((doc) => (
                            <div
                                key={doc.client_id}
                                style={{
                                    ...styles.docCard,
                                    ...(selectedDocId === doc.client_id
                                        ? styles.docCardSelected
                                        : {}),
                                    ...(doc.scrape_status === "processing"
                                        ? styles.docCardParsing
                                        : {}),
                                }}
                                onClick={() => setSelectedDocId(doc.client_id)}
                            >
                                <div style={styles.docIcon}>
                                    <FileJson size={18} color="#22d3ee" />
                                </div>
                                <div style={styles.docInfo}>
                                    <p style={styles.docName} title={doc.filename}>
                                        {doc.filename}
                                    </p>
                                    <p style={styles.docMeta}>
                                        {doc.file_size > 0 ? formatBytes(doc.file_size) : "—"}
                                        {doc.document_id && (
                                            <span style={{ marginLeft: 6, opacity: 0.6 }}>
                                                {doc.document_id.slice(0, 8)}…
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div style={styles.docActions}>
                                    <ScrapeStatusBadge status={doc.scrape_status} />
                                    {doc.scrape_status === "completed" && (
                                        <button
                                            style={styles.iconBtn}
                                            title="Export this doc"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleExportSingle(doc);
                                            }}
                                        >
                                            <DownloadCloud size={14} color="#22d3ee" />
                                        </button>
                                    )}
                                    {doc.scrape_status === "failed" && !isScraping && (
                                        <button
                                            style={styles.iconBtn}
                                            title="Retry"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                retryScrape(doc.client_id);
                                            }}
                                        >
                                            <RotateCcw size={14} color="#f59e0b" />
                                        </button>
                                    )}
                                    {doc.scrape_status !== "processing" &&
                                        doc.scrape_status !== "queued" && (
                                            <button
                                                style={styles.iconBtn}
                                                title="Remove"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeDocument(doc.client_id);
                                                }}
                                            >
                                                <XCircle size={14} color="#6b7280" />
                                            </button>
                                        )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Action Bar ──────────────────────────────────── */}
                    <div style={styles.actionBar}>
                        {/* ScrapeAllButton handles ALL docs via store */}
                        <ScrapeAllButton />

                        {doneDocs > 0 && !isScraping && (
                            <button style={styles.btnExport} onClick={handleExportAll}>
                                <DownloadCloud size={14} /> Export All Results ({doneDocs})
                            </button>
                        )}

                        <button
                            style={styles.btnSecondary}
                            onClick={() => setShowPreview((p) => !p)}
                        >
                            {showPreview ? (
                                <ChevronUp size={14} />
                            ) : (
                                <ChevronDown size={14} />
                            )}
                            {showPreview ? "Hide Preview" : "Show Preview"}
                        </button>
                    </div>

                    {/* ── Preview Panel ────────────────────────────────── */}
                    {showPreview && selectedDoc && (
                        <div style={styles.preview}>
                            <div style={styles.previewHeader}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <FileJson size={14} color="#22d3ee" />
                                    <span style={{ color: "#9ca3af", fontSize: 13 }}>
                                        {selectedDoc.filename}
                                    </span>
                                    {selectedDoc.result && (
                                        <span style={badge("blue")}>
                                            {selectedDoc.scrape_status}
                                        </span>
                                    )}
                                </div>
                                {selectedDoc.scrape_status === "completed" && (
                                    <button
                                        style={styles.btnExport}
                                        onClick={() => handleExportSingle(selectedDoc)}
                                    >
                                        <DownloadCloud size={13} /> Export
                                    </button>
                                )}
                            </div>

                            {/* States */}
                            {(selectedDoc.scrape_status === "not_started" ||
                                selectedDoc.upload_status === "pending" ||
                                selectedDoc.upload_status === "uploading") && (
                                    <p style={styles.previewPlaceholder}>
                                        {selectedDoc.upload_status === "uploading"
                                            ? "Uploading document…"
                                            : 'Click "Scrape All Files" to extract this document.'}
                                    </p>
                                )}

                            {selectedDoc.scrape_status === "queued" && (
                                <p style={styles.previewPlaceholder}>
                                    <Clock size={16} color="#22d3ee" /> Queued for processing…
                                </p>
                            )}

                            {selectedDoc.scrape_status === "processing" && (
                                <div style={styles.previewPlaceholder}>
                                    <Loader2 size={20} color="#22d3ee" className="spin" />
                                    <span>Extracting document…</span>
                                </div>
                            )}

                            {selectedDoc.scrape_status === "failed" && (
                                <p
                                    style={{ ...styles.previewPlaceholder, color: "#f87171" }}
                                >
                                    ✗ Error: {selectedDoc.scrape_error ?? "Unknown error"}
                                </p>
                            )}

                            {selectedDoc.upload_status === "failed" && (
                                <p
                                    style={{ ...styles.previewPlaceholder, color: "#f87171" }}
                                >
                                    ✗ Upload failed: {selectedDoc.upload_error ?? "Unknown error"}
                                </p>
                            )}

                            {selectedDoc.scrape_status === "completed" &&
                                selectedDoc.result && (
                                    <div>
                                        <p style={styles.previewSectionLabel}>EXTRACTED DATA</p>
                                        <pre style={styles.previewText}>
                                            {JSON.stringify(selectedDoc.result, null, 2)}
                                        </pre>
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
// Status Badge
// ─────────────────────────────────────────────
function ScrapeStatusBadge({
    status,
}: {
    status: string;
}) {
    if (status === "not_started")
        return <span style={badge("neutral")}><Clock size={10} /> Queued</span>;
    if (status === "queued")
        return <span style={badge("neutral")}><Clock size={10} /> Queued</span>;
    if (status === "processing")
        return (
            <span style={badge("blue")}>
                <Loader2 size={10} className="spin" /> Parsing
            </span>
        );
    if (status === "completed")
        return (
            <span style={badge("green")}>
                <CheckCircle2 size={10} /> Done
            </span>
        );
    return (
        <span style={badge("red")}>
            <XCircle size={10} /> Error
        </span>
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
        padding: "24px 32px",
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        color: C.text,
    },
    header: { marginBottom: 28 },
    headerSub: {
        fontSize: 10,
        letterSpacing: "0.15em",
        color: C.accent,
        margin: "0 0 6px",
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 700,
        margin: "0 0 4px",
        color: C.text,
    },
    headerDesc: { fontSize: 13, color: C.muted, margin: 0 },
    stepsRow: {
        display: "flex",
        gap: 8,
        marginBottom: 28,
        flexWrap: "wrap" as const,
    },
    step: {
        fontSize: 11,
        padding: "4px 14px",
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        color: C.muted,
        background: C.surface,
    },
    stepActive: {
        background: C.accent,
        color: "#000",
        border: `1px solid ${C.accent}`,
        fontWeight: 700,
    },
    sectionLabel: {
        fontSize: 10,
        letterSpacing: "0.12em",
        color: C.accent,
        marginBottom: 8,
    },
    docsHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 28,
        marginBottom: 12,
    },
    docsLabel: {
        fontSize: 11,
        letterSpacing: "0.1em",
        color: C.muted,
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    docGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 10,
        marginBottom: 16,
    },
    docCard: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 9,
        background: C.surface,
        border: `1px solid ${C.border}`,
        cursor: "pointer",
        transition: "all 0.15s",
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
        width: 36,
        height: 36,
        borderRadius: 8,
        background: "rgba(34,211,238,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    docInfo: { flex: 1, minWidth: 0 },
    docName: {
        fontSize: 12,
        fontWeight: 500,
        margin: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: C.text,
    },
    docMeta: { fontSize: 11, color: C.muted, margin: "2px 0 0" },
    docActions: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
    },
    actionBar: {
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginBottom: 16,
        flexWrap: "wrap" as const,
    },
    btnSecondary: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 20px",
        borderRadius: 7,
        border: `1px solid ${C.border}`,
        background: C.surface,
        color: C.text,
        fontSize: 13,
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "inherit",
    },
    btnExport: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 18px",
        borderRadius: 7,
        border: `1px solid ${C.accent}`,
        background: C.accentBg,
        color: C.accent,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
        fontWeight: 600,
    },
    btnGhost: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        borderRadius: 6,
        border: "none",
        background: "transparent",
        color: C.muted,
        fontSize: 12,
        cursor: "pointer",
        fontFamily: "inherit",
    },
    iconBtn: {
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 4,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
    },
    // ── Preview — NO white background ─────────────────────────
    preview: {
        background: C.surface,          // dark surface, NOT white
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 20,
    },
    previewHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        borderBottom: `1px solid ${C.border}`,
        paddingBottom: 12,
    },
    previewPlaceholder: {
        color: C.muted,
        fontSize: 13,
        textAlign: "center",
        padding: "32px 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        margin: 0,
    },
    previewText: {
        color: C.muted,
        fontSize: 12,
        lineHeight: 1.7,
        background: C.bg,             // dark bg inside preview too
        padding: 16,
        borderRadius: 7,
        border: `1px solid ${C.border}`,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        maxHeight: 480,
        overflowY: "auto",
    },
    previewSectionLabel: {
        fontSize: 10,
        letterSpacing: "0.1em",
        color: C.accent,
        margin: "0 0 8px",
    },
};

// ── Badge helpers ──────────────────────────────────────────────
function pill(color: "green" | "red" | "blue" | "neutral") {
    return {
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 600,
        marginLeft: 6,
        background:
            color === "green"
                ? "rgba(52,211,153,0.12)"
                : color === "red"
                    ? "rgba(248,113,113,0.12)"
                    : color === "blue"
                        ? "rgba(96,165,250,0.12)"
                        : "rgba(139,148,158,0.12)",
        color:
            color === "green"
                ? C.green
                : color === "red"
                    ? C.danger
                    : color === "blue"
                        ? C.blue
                        : C.muted,
    } as React.CSSProperties;
}

function badge(color: "green" | "red" | "blue" | "neutral") {
    return {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 600,
        background:
            color === "green"
                ? "rgba(52,211,153,0.12)"
                : color === "red"
                    ? "rgba(248,113,113,0.12)"
                    : color === "blue"
                        ? "rgba(96,165,250,0.12)"
                        : "rgba(139,148,158,0.1)",
        color:
            color === "green"
                ? "#34d399"
                : color === "red"
                    ? "#f87171"
                    : color === "blue"
                        ? "#60a5fa"
                        : "#8b949e",
    } as React.CSSProperties;
}