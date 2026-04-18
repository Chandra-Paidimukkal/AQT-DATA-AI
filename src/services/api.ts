const API_BASE = import.meta.env.VITE_API_BASE_URL || "";


export interface ApiError {
  status: number;
  message: string;
  detail?: any;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData.detail) {
        if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((d: any) => `${d.loc?.join(".")}: ${d.msg}`).join("; ");
        } else {
          errorMessage = JSON.stringify(errorData.detail);
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      const text = await res.text().catch(() => "");
      if (text) errorMessage = text;
    }
    const err = new Error(errorMessage) as Error & { status: number; detail: any };
    err.status = res.status;
    throw err;
  }
  // Handle 204 No Content
  if (res.status === 204) return {} as T;
  return res.json();
}

export const api = {
  getBaseUrl: () => API_BASE,

  // Health
  health: () => fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()),

  // Documents
  uploadSingle: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<any>("/api/v1/documents/upload", { method: "POST", body: fd });
  },
  uploadBatch: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return request<any>("/api/v1/documents/upload/batch", { method: "POST", body: fd });
  },
  uploadFolderZip: (file: File, folderName?: string) => {
    const fd = new FormData();
    fd.append("zip_file", file);
    if (folderName) fd.append("folder_name", folderName);
    return request<any>("/api/v1/documents/upload/folder-zip", { method: "POST", body: fd });
  },
  getParsedDocument: (id: string) => request<any>(`/api/v1/documents/${id}/parsed`),
  suggestSchema: (id: string) => request<any>(`/api/v1/documents/${id}/suggest-schema`, { method: "POST" }),

  // Schemas
  listSchemas: (page = 1, pageSize = 50) => request<any>(`/api/v1/schemas?page=${page}&page_size=${pageSize}`),
  getSchema: (id: string) => request<any>(`/api/v1/schemas/${id}`),
  createSchema: (name: string, definition: any) =>
    request<any>("/api/v1/schemas", { method: "POST", body: JSON.stringify({ name, schema_definition: definition }) }),
  uploadSchema: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<any>("/api/v1/schemas/upload", { method: "POST", body: fd });
  },
  schemaFromText: (text: string) =>
    request<any>("/api/v1/schemas/from-text", { method: "POST", body: JSON.stringify({ text }) }),
  deleteSchema: (id: string) => request<any>(`/api/v1/schemas/${id}`, { method: "DELETE" }),

  // Sessions
  createSession: (payload: {
    session_id?: string;
    mode: string;
    provider: string;
    provider_config?: Record<string, any>;
  }) =>
    request<any>("/api/v1/sessions/provider-config", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listSessions: (page = 1, pageSize = 50) => request<any>(`/api/v1/sessions?page=${page}&page_size=${pageSize}`),
  getSession: (id: string) => request<any>(`/api/v1/sessions/${id}`),
  deleteSession: (id: string) => request<any>(`/api/v1/sessions/${id}`, { method: "DELETE" }),

  // Extraction
  runExtraction: (sessionId: string, documentId: string, schemaId?: string, schemaDefinition?: Record<string, any>) =>
    request<any>("/api/v1/extraction/run", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        document_id: documentId,
        ...(schemaId && { schema_id: schemaId }),
        ...(schemaDefinition && { schema_definition: schemaDefinition }),
      }),
    }),
  runBatchExtraction: (sessionId: string, documentIds: string[], schemaId?: string) =>
    request<any>("/api/v1/extraction/run-batch", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        document_ids: documentIds,
        ...(schemaId && { schema_id: schemaId }),
      }),
    }),

  // Jobs
  listJobs: (page = 1, pageSize = 20) => request<any>(`/api/v1/extraction/jobs?page=${page}&page_size=${pageSize}`),
  getJobResult: (id: string) => request<any>(`/api/v1/extraction/results/${id}`),
  deleteJob: (id: string) => request<any>(`/api/v1/extraction/jobs/${id}`, { method: "DELETE" }),

  // Aliases
  listAliases: () => request<any>("/api/v1/aliases"),
  getFieldAliases: (field: string) => request<any>(`/api/v1/aliases/${field}`),
  addAlias: (data: any) => request<any>("/api/v1/aliases/add", { method: "POST", body: JSON.stringify(data) }),
  approveAlias: (data: any) => request<any>("/api/v1/aliases/approve", { method: "POST", body: JSON.stringify(data) }),
  removeAlias: (data: any) => request<any>("/api/v1/aliases/remove", { method: "DELETE", body: JSON.stringify(data) }),
  downloadAliasFile: () => fetch(`${API_BASE}/api/v1/aliases/download`),
  uploadAliasFile: (file: File, merge = true) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<any>(`/api/v1/aliases/upload?merge=${merge}`, { method: "POST", body: fd });
  },

  // Files
  listSchemaFiles: () => request<any>("/api/v1/files/schemas"),
  downloadSchemaFile: (fn: string) => `${API_BASE}/api/v1/files/schema/${fn}`,
  listResultFiles: () => request<any>("/api/v1/files/results"),
  downloadResultFile: (fn: string) => `${API_BASE}/api/v1/files/result/${fn}`,
  listExports: () => request<any>("/api/v1/files/exports"),
  downloadExport: (fn: string) => `${API_BASE}/api/v1/files/export/${fn}`,
  aliasMemoryFile: () => `${API_BASE}/api/v1/files/alias-memory`,

  // Save file content (requires backend PUT endpoints)
  saveSchemaFile: (filename: string, content: string) =>
    request<any>(`/api/v1/files/schema/${filename}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  saveResultFile: (filename: string, content: string) =>
    request<any>(`/api/v1/files/result/${filename}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  saveExportFile: (filename: string, content: string) =>
    request<any>(`/api/v1/files/export/${filename}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  // Dashboard
  dashboardSummary: () => request<any>("/api/v1/dashboard/summary"),
};
