// ─────────────────────────────────────────────────────────────
//  DocumentQueueTable.tsx
//  Shows every queued document with per-row status + actions
// ─────────────────────────────────────────────────────────────

import React from "react";
import {
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    RotateCcw,
    Trash2,
    FileText,
    AlertCircle,
} from "lucide-react";
import { useDocumentQueue } from "@/store/useDocumentQueue";
import type { QueuedDocument, ScrapeStatus, UploadStatus } from "@/types/document";
import { cn } from "@/lib/utils";

export function DocumentQueueTable() {
    const { documents, removeDocument, retryScrape, isScraping } =
        useDocumentQueue();

    if (documents.length === 0) return null;

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                            <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                                Filename
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 hidden sm:table-cell">
                                Document ID
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                                Upload
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                                Scrape
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-right">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {documents.map((doc) => (
                            <DocumentRow
                                key={doc.client_id}
                                doc={doc}
                                onRemove={() => removeDocument(doc.client_id)}
                                onRetry={() => retryScrape(doc.client_id)}
                                isScraping={isScraping}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer summary */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                <span>{documents.length} document{documents.length !== 1 ? "s" : ""} in queue</span>
                <span>
                    {documents.filter((d) => d.scrape_status === "completed").length} completed ·{" "}
                    {documents.filter((d) => d.scrape_status === "failed").length} failed
                </span>
            </div>
        </div>
    );
}

// ── Row ───────────────────────────────────────────────────────
function DocumentRow({
    doc,
    onRemove,
    onRetry,
    isScraping,
}: {
    doc: QueuedDocument;
    onRemove: () => void;
    onRetry: () => void;
    isScraping: boolean;
}) {
    const canRetry =
        doc.upload_status === "success" &&
        doc.scrape_status === "failed" &&
        !isScraping;

    const canRemove =
        doc.scrape_status !== "processing" && doc.scrape_status !== "queued";

    return (
        <tr className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            {/* Filename */}
            <td className="px-4 py-3 max-w-[200px]">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    <span
                        className="truncate font-medium text-slate-800 dark:text-slate-100"
                        title={doc.filename}
                    >
                        {doc.filename}
                    </span>
                </div>
                {/* Show size */}
                {doc.file_size > 0 && (
                    <p className="mt-0.5 ml-6 text-xs text-slate-400">
                        {formatBytes(doc.file_size)}
                    </p>
                )}
            </td>

            {/* Document ID */}
            <td className="px-4 py-3 hidden sm:table-cell">
                {doc.document_id ? (
                    <code className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5 text-slate-600 dark:text-slate-300">
                        {doc.document_id.slice(0, 12)}…
                    </code>
                ) : (
                    <span className="text-slate-400 text-xs">—</span>
                )}
            </td>

            {/* Upload status */}
            <td className="px-4 py-3">
                <UploadBadge status={doc.upload_status} error={doc.upload_error} />
            </td>

            {/* Scrape status */}
            <td className="px-4 py-3">
                <ScrapeBadge status={doc.scrape_status} error={doc.scrape_error} />
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                    {canRetry && (
                        <button
                            onClick={onRetry}
                            title="Retry scrape"
                            className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </button>
                    )}
                    {canRemove && (
                        <button
                            onClick={onRemove}
                            title="Remove from queue"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ── Status badges ─────────────────────────────────────────────
function UploadBadge({
    status,
    error,
}: {
    status: UploadStatus;
    error?: string;
}) {
    const map: Record<
        UploadStatus,
        { icon: React.ReactNode; label: string; cls: string }
    > = {
        pending: {
            icon: <Clock className="h-3.5 w-3.5" />,
            label: "Pending",
            cls: "text-slate-500 bg-slate-100 dark:bg-slate-800",
        },
        uploading: {
            icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
            label: "Uploading",
            cls: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
        },
        success: {
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            label: "Uploaded",
            cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
        },
        failed: {
            icon: <XCircle className="h-3.5 w-3.5" />,
            label: "Failed",
            cls: "text-red-600 bg-red-50 dark:bg-red-900/30",
        },
    };

    const { icon, label, cls } = map[status];

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                cls
            )}
            title={error}
        >
            {icon}
            {label}
        </span>
    );
}

function ScrapeBadge({
    status,
    error,
}: {
    status: ScrapeStatus;
    error?: string;
}) {
    const map: Record<
        ScrapeStatus,
        { icon: React.ReactNode; label: string; cls: string }
    > = {
        not_started: {
            icon: <Clock className="h-3.5 w-3.5" />,
            label: "Not Started",
            cls: "text-slate-500 bg-slate-100 dark:bg-slate-800",
        },
        queued: {
            icon: <Clock className="h-3.5 w-3.5 animate-pulse" />,
            label: "Queued",
            cls: "text-violet-600 bg-violet-50 dark:bg-violet-900/30",
        },
        processing: {
            icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
            label: "Processing",
            cls: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
        },
        completed: {
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            label: "Completed",
            cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
        },
        failed: {
            icon: <AlertCircle className="h-3.5 w-3.5" />,
            label: "Failed",
            cls: "text-red-600 bg-red-50 dark:bg-red-900/30",
        },
    };

    const { icon, label, cls } = map[status];

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                cls
            )}
            title={error}
        >
            {icon}
            {label}
        </span>
    );
}

// ── Helpers ───────────────────────────────────────────────────
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}