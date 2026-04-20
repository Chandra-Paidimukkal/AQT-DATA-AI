// ─────────────────────────────────────────────────────────────
//  ExtractionPage.tsx
//  Drop-in replacement for your existing extraction/index page.
//  Wires together: DropZone → DocumentQueueTable → ScrapeAllButton
// ─────────────────────────────────────────────────────────────

import React from "react";
import { DropZone } from "@/components/DropZone";
import { DocumentQueueTable } from "@/components/DocumentQueueTable";
import { ScrapeAllButton } from "@/components/ScrapeAllButton";
import { useDocumentQueue } from "@/store/useDocumentQueue";
import { FileSearch } from "lucide-react";

export default function ExtractionPage() {
    const { documents } = useDocumentQueue();

    const completedCount = documents.filter(
        (d) => d.scrape_status === "completed"
    ).length;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">

                {/* ── Header ──────────────────────────────────────── */}
                <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-blue-600 p-3 shadow-md">
                        <FileSearch className="h-7 w-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            AQT Intelligent Data Extraction
                        </h1>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                            Upload files, folders, or ZIPs — then scrape all with one click.
                        </p>
                    </div>
                </div>

                {/* ── Stats bar (shown when there are docs) ────────── */}
                {documents.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard
                            label="Total"
                            value={documents.length}
                            color="slate"
                        />
                        <StatCard
                            label="Uploaded"
                            value={documents.filter((d) => d.upload_status === "success").length}
                            color="blue"
                        />
                        <StatCard
                            label="Completed"
                            value={completedCount}
                            color="emerald"
                        />
                        <StatCard
                            label="Failed"
                            value={
                                documents.filter(
                                    (d) =>
                                        d.upload_status === "failed" ||
                                        d.scrape_status === "failed"
                                ).length
                            }
                            color="red"
                        />
                    </div>
                )}

                {/* ── Drop Zone ────────────────────────────────────── */}
                <DropZone />

                {/* ── Scrape CTA ───────────────────────────────────── */}
                <ScrapeAllButton />

                {/* ── Queue Table ──────────────────────────────────── */}
                <DocumentQueueTable />

            </div>
        </div>
    );
}

// ── Small stat card ───────────────────────────────────────────
function StatCard({
    label,
    value,
    color,
}: {
    label: string;
    value: number;
    color: "slate" | "blue" | "emerald" | "red";
}) {
    const cls = {
        slate: "text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
        blue: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
        emerald: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
        red: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    }[color];

    return (
        <div className={`rounded-xl border px-4 py-3 ${cls}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs font-medium opacity-70 mt-0.5">{label}</p>
        </div>
    );
}