// ─────────────────────────────────────────────────────────────
//  ScrapeAllButton.tsx
//  Shows count of scrapeable docs, progress bar while running
// ─────────────────────────────────────────────────────────────

import React from "react";
import { Zap, Loader2 } from "lucide-react";
import { useDocumentQueue } from "@/store/useDocumentQueue";
import { cn } from "@/lib/utils";

export function ScrapeAllButton() {
    const { documents, isScraping, scrapeProgress, scrapeAll, clearQueue } =
        useDocumentQueue();

    const pending = documents.filter(
        (d) =>
            d.upload_status === "success" &&
            (d.scrape_status === "not_started" || d.scrape_status === "failed")
    );

    const allDone =
        documents.length > 0 &&
        documents.every(
            (d) =>
                d.scrape_status === "completed" ||
                d.upload_status === "failed"
        );

    const progress =
        isScraping && scrapeProgress.total > 0
            ? Math.round((scrapeProgress.done / scrapeProgress.total) * 100)
            : 0;

    if (documents.length === 0) return null;

    return (
        <div className="flex flex-col gap-3">
            {/* Primary scrape button */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => scrapeAll()}
                    disabled={isScraping || pending.length === 0}
                    className={cn(
                        "flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-md transition-all duration-200",
                        isScraping || pending.length === 0
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 active:scale-95 hover:shadow-lg"
                    )}
                >
                    {isScraping ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Scraping… ({scrapeProgress.done}/{scrapeProgress.total})
                        </>
                    ) : (
                        <>
                            <Zap className="h-5 w-5" />
                            Scrape All Files
                            {pending.length > 0 && (
                                <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                                    {pending.length}
                                </span>
                            )}
                        </>
                    )}
                </button>

                {allDone && !isScraping && (
                    <button
                        type="button"
                        onClick={() => clearQueue()}
                        className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Clear Queue
                    </button>
                )}
            </div>

            {/* Progress bar */}
            {isScraping && (
                <div className="space-y-1">
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {progress}% — {scrapeProgress.done} of {scrapeProgress.total} files
                        processed
                    </p>
                </div>
            )}
        </div>
    );
}