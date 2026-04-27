// ─────────────────────────────────────────────────────────────
//  AQT API Client
//  All calls proxy through Vite → http://127.0.0.1:8000
// ─────────────────────────────────────────────────────────────

import type {
    UploadResponse,
    ZipUploadResponse,
    ExtractionResponse,
} from "@/types/document";

const BASE = "/api/v1";

// ── Upload a single file ──────────────────────────────────────
export async function uploadDocument(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${BASE}/documents/`, {
        method: "POST",
        body: form,
    });

    if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Upload failed for "${file.name}": ${msg}`);
    }

    return res.json();
}

// ── Upload a ZIP and get back all extracted document entries ──
export async function uploadZip(file: File): Promise<ZipUploadResponse> {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${BASE}/documents/zip/`, {
        method: "POST",
        body: form,
    });

    if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`ZIP upload failed: ${msg}`);
    }

    return res.json();
}

// ── Trigger extraction for one document ──────────────────────
export async function extractDocument(
    document_id: string
): Promise<ExtractionResponse> {
    const res = await fetch(`${BASE}/extractions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id }),
    });

    if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Extraction failed for document "${document_id}": ${msg}`);
    }

    return res.json();
}

// ── Poll extraction status ────────────────────────────────────
export async function getExtractionStatus(
    extraction_id: string
): Promise<ExtractionResponse> {
    const res = await fetch(`${BASE}/extractions/${extraction_id}/`);

    if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Status check failed: ${msg}`);
    }

    return res.json();
}