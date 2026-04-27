export interface ApiResponse<T = any> {
  status: string;
  message: string;
  data: T;
  error: string | null;
}

export interface Document {
  document_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  parsed: boolean;
}

export interface ParsedDocument {
  document_id: string;
  content: any;
  metadata: any;
}

export interface Schema {
  schema_id: string;
  name: string;
  schema_definition: Record<string, any>;
  created_at: string;
}

export interface Session {
  session_id: string;
  mode: "auto" | "python" | "ai" | "hybrid";
  provider: string;
  provider_config: Record<string, any>;
  created_at?: string;
}

export interface Job {
  job_id: string;
  document_id: string;
  filename: string;
  status: string;
  engine: string;
  strategy?: string;
  created_at: string;
  result?: any;
}

export interface ExtractionResult {
  job_id: string;
  data: any;
  engine: string;
  strategy?: string;
  status: string;
}

export interface Alias {
  field_name: string;
  aliases: string[];
  approved: boolean;
}

export interface DashboardSummary {
  documents_count: number;
  schemas_count: number;
  jobs_count: number;
  exports_count: number;
  latest_documents: Document[];
  latest_jobs: Job[];
}

export interface FileInfo {
  filename: string;
  size?: number;
  created_at?: string;
}
