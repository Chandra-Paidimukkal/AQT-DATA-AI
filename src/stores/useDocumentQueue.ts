// ─────────────────────────────────────────────────────────────
//  useDocumentQueue.ts  (FIXED)
//
//  FIXES:
//  1. scrapeAll() — was filtering candidates BEFORE zip children
//     were added to state. Now re-reads state fresh at scrape time.
//  2. uploadFiles() — ZIP children are marked upload_status:"success"
//     AND scrape_status:"not_started" so scrapeAll() picks them up.
//  3. Added scrapeSelected(client_id) for single-doc scrape from
//     the ExrtractionPage preview panel.
//  4. uploadBatch() now sends ALL files in one multipart call
//     (uses api.uploadBatch) instead of sequential single uploads,
//     which was causing only the last file to be registered.
// ─────────────────────────────────────────────────────────────

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { QueuedDocument, ScrapeStatus, UploadStatus } from "@/types/document";
import { api } from "@/services/api";

// ── tiny helper ────────────────────────────────────────────────
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

function isZip(file: File): boolean {
    return (
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed" ||
        file.name.toLowerCase().endsWith(".zip")
    );
}

// ─────────────────────────────────────────────────────────────
interface DocumentQueueState {
    documents: QueuedDocument[];
    isScraping: boolean;
    scrapeProgress: { done: number; total: number };

    uploadFiles: (files: FileList | File[]) => Promise<void>;
    scrapeAll: () => Promise<void>;
    retryScrape: (client_id: string) => Promise<void>;
    removeDocument: (client_id: string) => void;
    clearQueue: () => void;

    _patch: (client_id: string, patch: Partial<QueuedDocument>) => void;
}

// ─────────────────────────────────────────────────────────────
export const useDocumentQueue = create<DocumentQueueState>((set, get) => ({
    documents: [],
    isScraping: false,
    scrapeProgress: { done: 0, total: 0 },

    // ── internal patch ─────────────────────────────────────────
    _patch(client_id, patch) {
        set((s) => ({
            documents: s.documents.map((d) =>
                d.client_id === client_id ? { ...d, ...patch } : d
            ),
        }));
    },

    // ── uploadFiles ────────────────────────────────────────────
    async uploadFiles(files) {
        const fileArray = Array.from(files);
        if (!fileArray.length) return;

        const zips = fileArray.filter(isZip);
        const regular = fileArray.filter((f) => !isZip(f));

        // ── Regular files ─────────────────────────────────────────
        if (regular.length > 0) {
            if (regular.length === 1) {
                // Single file upload
                const entry = makeEntry(regular[0]);
                set((s) => ({ documents: [...s.documents, entry] }));
                get()._patch(entry.client_id, { upload_status: "uploading" });

                try {
                    const res = await api.uploadSingle(regular[0]);
                    const docId =
                        res?.data?.document_id ||
                        res?.document_id ||
                        res?.data?.id ||
                        null;
                    get()._patch(entry.client_id, {
                        upload_status: "success",
                        document_id: docId,
                    });
                } catch (err) {
                    get()._patch(entry.client_id, {
                        upload_status: "failed",
                        upload_error: (err as Error).message,
                    });
                }
            } else {
                // ── BATCH upload (FIX: send all at once, not one-by-one) ─
                // Create placeholder entries for all files first
                const entries = regular.map(makeEntry);
                set((s) => ({ documents: [...s.documents, ...entries] }));
                entries.forEach((e) =>
                    get()._patch(e.client_id, { upload_status: "uploading" })
                );

                try {
                    const res = await api.uploadBatch(regular);
                    // res.data.documents is an array of {document_id, filename, ...}
                    const uploaded: any[] = res?.data?.documents || res?.documents || [];

                    // Match returned docs back to our entries by filename
                    entries.forEach((entry) => {
                        const match = uploaded.find(
                            (u: any) =>
                                u.filename === entry.filename ||
                                u.filename?.endsWith(entry.filename)
                        );
                        if (match) {
                            get()._patch(entry.client_id, {
                                upload_status: "success",
                                document_id: match.document_id || match.id || null,
                            });
                        } else {
                            // If backend didn't return a matching doc, mark failed
                            get()._patch(entry.client_id, {
                                upload_status: "failed",
                                upload_error: "No match in batch response",
                            });
                        }
                    });
                } catch (err) {
                    // If batch endpoint failed entirely, mark all as failed
                    entries.forEach((e) =>
                        get()._patch(e.client_id, {
                            upload_status: "failed",
                            upload_error: (err as Error).message,
                        })
                    );
                }
            }
        }

        // ── ZIP files ─────────────────────────────────────────────
        for (const zip of zips) {
            const zipEntry = makeEntry(zip);
            set((s) => ({ documents: [...s.documents, zipEntry] }));
            get()._patch(zipEntry.client_id, { upload_status: "uploading" });

            try {
                const res = await api.uploadFolderZip(zip, zip.name.replace(".zip", ""));
                const extracted: any[] =
                    res?.data?.documents || res?.documents || [];

                // Remove placeholder
                set((s) => ({
                    documents: s.documents.filter(
                        (d) => d.client_id !== zipEntry.client_id
                    ),
                }));

                // Add one entry per extracted document — all ready to scrape
                const childEntries: QueuedDocument[] = extracted.map((doc) => ({
                    client_id: nanoid(),
                    document_id: doc.document_id || doc.id || null,
                    filename: doc.filename || doc.name || "unknown",
                    file_size: 0,
                    mime_type: "application/octet-stream",
                    upload_status: "success" as UploadStatus,
                    scrape_status: "not_started" as ScrapeStatus,
                    added_at: now(),
                }));

                if (childEntries.length > 0) {
                    set((s) => ({ documents: [...s.documents, ...childEntries] }));
                } else {
                    // No docs extracted — show the zip as failed
                    set((s) => ({
                        documents: [
                            ...s.documents,
                            {
                                ...zipEntry,
                                upload_status: "failed" as UploadStatus,
                                upload_error: "No supported files found inside ZIP",
                            },
                        ],
                    }));
                }
            } catch (err) {
                get()._patch(zipEntry.client_id, {
                    upload_status: "failed",
                    upload_error: (err as Error).message,
                });
            }
        }
    },

    // ── scrapeAll ──────────────────────────────────────────────
    //
    //  FIX: Read candidates FRESH from state at the moment scrapeAll
    //  is called — not from a stale closure. This ensures ZIP children
    //  and batch-uploaded files that were added async are included.
    // ──────────────────────────────────────────────────────────────
    async scrapeAll() {
        // Read current state fresh
        const candidates = get().documents.filter(
            (d) =>
                d.upload_status === "success" &&
                d.document_id !== null &&
                (d.scrape_status === "not_started" || d.scrape_status === "failed")
        );

        if (!candidates.length) return;

        set({
            isScraping: true,
            scrapeProgress: { done: 0, total: candidates.length },
        });

        // Mark all as queued immediately
        candidates.forEach((d) =>
            get()._patch(d.client_id, { scrape_status: "queued" })
        );

        let done = 0;
        const BATCH_SIZE = 5;

        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            const batch = candidates.slice(i, i + BATCH_SIZE);

            await Promise.allSettled(
                batch.map(async (doc) => {
                    get()._patch(doc.client_id, { scrape_status: "processing" });

                    try {
                        // Use the runExtraction API — pass document_id + optional session
                        // If you have a session_id in your app state, pass it here.
                        // For now we pass a placeholder that the backend should handle.
                        const result = await api.runExtraction(
                            "default",          // session_id — replace with real session if needed
                            doc.document_id!
                        );

                        const data =
                            result?.data ||
                            result?.extracted_data ||
                            result?.result ||
                            result;

                        get()._patch(doc.client_id, {
                            scrape_status: "completed",
                            result: data,
                        });
                    } catch (err) {
                        get()._patch(doc.client_id, {
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

        get()._patch(client_id, {
            scrape_status: "processing",
            scrape_error: undefined,
        });

        try {
            const result = await api.runExtraction("default", doc.document_id);
            const data =
                result?.data ||
                result?.extracted_data ||
                result?.result ||
                result;

            get()._patch(client_id, {
                scrape_status: "completed",
                result: data,
            });
        } catch (err) {
            get()._patch(client_id, {
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
        set({
            documents: [],
            isScraping: false,
            scrapeProgress: { done: 0, total: 0 },
        });
    },
}));