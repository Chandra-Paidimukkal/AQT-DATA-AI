// ─────────────────────────────────────────────────────────────
//  useDocumentQueue  —  Zustand store
//
//  Single source of truth for ALL uploaded documents.
//  Replaces the old `uploadedDocument` (singular) pattern.
// ─────────────────────────────────────────────────────────────

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { QueuedDocument, ScrapeStatus, UploadStatus } from "@/types/document";
import {
    uploadDocument,
    uploadZip,
    extractDocument,
} from "@/api/documents";

// ── tiny helper ───────────────────────────────────────────────
function now() {
    return new Date().toISOString();
}

function makeEntry(file: File): QueuedDocument {
    return {
        client_id: nanoid(),
        document_id: null,
        filename: file.name,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        upload_status: "pending",
        scrape_status: "not_started",
        added_at: now(),
    };
}

// ─────────────────────────────────────────────────────────────
interface DocumentQueueState {
    // ── data ────────────────────────────────────────────────────
    documents: QueuedDocument[];

    // ── derived helpers ─────────────────────────────────────────
    isScraping: boolean;
    scrapeProgress: { done: number; total: number };

    // ── actions ─────────────────────────────────────────────────

    /** Upload any mix of regular files, folder files, and ZIP files */
    uploadFiles: (files: FileList | File[]) => Promise<void>;

    /** Scrape ALL documents that are not_started or failed */
    scrapeAll: () => Promise<void>;

    /** Retry scrape for a single document */
    retryScrape: (client_id: string) => Promise<void>;

    /** Remove a document from the queue */
    removeDocument: (client_id: string) => void;

    /** Clear the entire queue */
    clearQueue: () => void;

    // internal patch helpers
    _patchUpload: (client_id: string, patch: Partial<QueuedDocument>) => void;
    _patchScrape: (client_id: string, patch: Partial<QueuedDocument>) => void;
}

// ─────────────────────────────────────────────────────────────
export const useDocumentQueue = create<DocumentQueueState>((set, get) => ({
    documents: [],
    isScraping: false,
    scrapeProgress: { done: 0, total: 0 },

    // ── internal patchers ──────────────────────────────────────
    _patchUpload(client_id, patch) {
        set((s) => ({
            documents: s.documents.map((d) =>
                d.client_id === client_id ? { ...d, ...patch } : d
            ),
        }));
    },

    _patchScrape(client_id, patch) {
        set((s) => ({
            documents: s.documents.map((d) =>
                d.client_id === client_id ? { ...d, ...patch } : d
            ),
        }));
    },

    // ── uploadFiles ────────────────────────────────────────────
    async uploadFiles(files) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        // Separate ZIPs from regular files
        const zips = fileArray.filter(
            (f) =>
                f.type === "application/zip" ||
                f.type === "application/x-zip-compressed" ||
                f.name.toLowerCase().endsWith(".zip")
        );
        const regular = fileArray.filter((f) => !zips.includes(f));

        // ── Regular files: add entries + upload in parallel ───────
        const regularEntries = regular.map(makeEntry);
        if (regularEntries.length) {
            set((s) => ({ documents: [...s.documents, ...regularEntries] }));

            await Promise.allSettled(
                regular.map(async (file, i) => {
                    const entry = regularEntries[i];
                    get()._patchUpload(entry.client_id, { upload_status: "uploading" });

                    try {
                        const res = await uploadDocument(file);
                        get()._patchUpload(entry.client_id, {
                            upload_status: "success",
                            document_id: res.document_id,
                        });
                    } catch (err) {
                        get()._patchUpload(entry.client_id, {
                            upload_status: "failed",
                            upload_error: (err as Error).message,
                        });
                    }
                })
            );
        }

        // ── ZIP files: upload → unpack → add all child entries ────
        for (const zip of zips) {
            // Placeholder entry for the ZIP itself while we upload
            const zipEntry = makeEntry(zip);
            set((s) => ({ documents: [...s.documents, zipEntry] }));
            get()._patchUpload(zipEntry.client_id, { upload_status: "uploading" });

            try {
                const res = await uploadZip(zip);
                // Remove the ZIP placeholder
                set((s) => ({
                    documents: s.documents.filter(
                        (d) => d.client_id !== zipEntry.client_id
                    ),
                }));

                // Add one entry per extracted document
                const childEntries: QueuedDocument[] = res.documents.map((doc) => ({
                    client_id: nanoid(),
                    document_id: doc.document_id,
                    filename: doc.filename,
                    file_size: 0,
                    mime_type: "application/octet-stream",
                    upload_status: "success" as UploadStatus,
                    scrape_status: "not_started" as ScrapeStatus,
                    added_at: now(),
                }));

                set((s) => ({ documents: [...s.documents, ...childEntries] }));
            } catch (err) {
                get()._patchUpload(zipEntry.client_id, {
                    upload_status: "failed",
                    upload_error: (err as Error).message,
                });
            }
        }
    },

    // ── scrapeAll ──────────────────────────────────────────────
    async scrapeAll() {
        const candidates = get().documents.filter(
            (d) =>
                d.upload_status === "success" &&
                d.document_id !== null &&
                (d.scrape_status === "not_started" || d.scrape_status === "failed")
        );

        if (candidates.length === 0) return;

        set({ isScraping: true, scrapeProgress: { done: 0, total: candidates.length } });

        // Mark all as queued immediately so the UI reflects intent
        candidates.forEach((d) =>
            get()._patchScrape(d.client_id, { scrape_status: "queued" })
        );

        let done = 0;

        // Process in batches of 5 to avoid overwhelming the backend
        const BATCH_SIZE = 5;
        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            const batch = candidates.slice(i, i + BATCH_SIZE);

            await Promise.allSettled(
                batch.map(async (doc) => {
                    get()._patchScrape(doc.client_id, { scrape_status: "processing" });

                    try {
                        const result = await extractDocument(doc.document_id!);
                        get()._patchScrape(doc.client_id, {
                            scrape_status: "completed",
                            result: {
                                extraction_id: result.extraction_id,
                                document_id: result.document_id,
                                status: result.status,
                                extracted_data: result.extracted_data,
                                confidence: result.confidence,
                                pages_processed: result.pages_processed,
                            },
                        });
                    } catch (err) {
                        get()._patchScrape(doc.client_id, {
                            scrape_status: "failed",
                            scrape_error: (err as Error).message,
                        });
                    } finally {
                        done++;
                        set((s) => ({
                            scrapeProgress: { ...s.scrapeProgress, done },
                        }));
                    }
                })
            );
        }

        set({ isScraping: false });
    },

    // ── retryScrape (single doc) ───────────────────────────────
    async retryScrape(client_id) {
        const doc = get().documents.find((d) => d.client_id === client_id);
        if (!doc || !doc.document_id) return;

        get()._patchScrape(client_id, {
            scrape_status: "processing",
            scrape_error: undefined,
        });

        try {
            const result = await extractDocument(doc.document_id);
            get()._patchScrape(client_id, {
                scrape_status: "completed",
                result: {
                    extraction_id: result.extraction_id,
                    document_id: result.document_id,
                    status: result.status,
                    extracted_data: result.extracted_data,
                    confidence: result.confidence,
                    pages_processed: result.pages_processed,
                },
            });
        } catch (err) {
            get()._patchScrape(client_id, {
                scrape_status: "failed",
                scrape_error: (err as Error).message,
            });
        }
    },

    // ── removeDocument ─────────────────────────────────────────
    removeDocument(client_id) {
        set((s) => ({
            documents: s.documents.filter((d) => d.client_id !== client_id),
        }));
    },

    // ── clearQueue ─────────────────────────────────────────────
    clearQueue() {
        set({ documents: [], scrapeProgress: { done: 0, total: 0 } });
    },
}));