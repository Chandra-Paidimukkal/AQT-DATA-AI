// ─────────────────────────────────────────────────────────────
//  AQT Document Queue Types
// ─────────────────────────────────────────────────────────────

export type UploadStatus = "pending" | "uploading" | "success" | "failed";
export type ScrapeStatus = "not_started" | "queued" | "processing" | "completed" | "failed";

export interface QueuedDocument {
    /** Unique client-side ID (generated before upload) */
    client_id: string;
    /** Server-assigned document ID (available after successful upload) */
    document_id: string | null;
    filename: string;
    file_size: number;
    mime_type: string;
    upload_status: UploadStatus;
    upload_error?: string;
    scrape_status: ScrapeStatus;
    scrape_error?: string;
    result?: ExtractionResult;
    /** ISO timestamp when added to queue */
    added_at: string;
}

export interface ExtractionResult {
    extraction_id: string;
    document_id: string;
    status: string;
    extracted_data?: Record<string, unknown>;
    confidence?: number;
    pages_processed?: number;
}

export interface UploadResponse {
    document_id: string;
    filename: string;
    status: string;
}

export interface ZipUploadResponse {
    documents: UploadResponse[];
    total: number;
}

export interface ExtractionResponse {
    extraction_id: string;
    document_id: string;
    status: string;
    extracted_data?: Record<string, unknown>;
    confidence?: number;
    pages_processed?: number;
}