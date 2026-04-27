const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export interface ApiError {
  status: number;
  message: string;
  detail?: any;
}

function buildUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

function withTimeout(ms = 15000): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  let message = `HTTP ${res.status}`;
  let detail: any = null;

  try {
    const errorData = await res.json();

    if (errorData?.detail) {
      detail = errorData.detail;

      if (typeof errorData.detail === "string") {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail
          .map((d: any) => `${d.loc?.join(".")}: ${d.msg}`)
          .join("; ");
      } else {
        message = JSON.stringify(errorData.detail);
      }
    } else if (errorData?.message) {
      message = errorData.message;
      detail = errorData;
    } else if (errorData?.error) {
      message = errorData.error;
      detail = errorData;
    } else {
      detail = errorData;
    }
  } catch {
    try {
      const text = await res.text();
      if (text) {
        message = text;
        detail = text;
      }
    } catch {
      // ignore
    }
  }

  return {
    status: res.status,
    message,
    detail,
  };
}

async function request<T>(path: string, options?: RequestInit, timeoutMs = 15000): Promise<T> {
  const res = await fetch(buildUrl(path), {
    ...options,
    signal: options?.signal || withTimeout(timeoutMs),
    headers: {
      ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const parsed = await parseErrorResponse(res);
    const err = new Error(parsed.message) as Error & ApiError;
    err.status = parsed.status;
    err.detail = parsed.detail;
    throw err;
  }

  if (res.status === 204) return {} as T;

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }

  return res.json();
}

async function rawFetch(path: string, options?: RequestInit, timeoutMs = 15000): Promise<Response> {
  return fetch(buildUrl(path), {
    ...options,
    signal: options?.signal || withTimeout(timeoutMs),
  });
}

export const api = {
  getBaseUrl: () => API_BASE,

  // Health
  health: async () => {
    const res = await rawFetch("/health", { method: "GET" }, 5000);
    if (!res.ok) {
      const parsed = await parseErrorResponse(res);
      const err = new Error(parsed.message) as Error & ApiError;
      err.status = parsed.status;
      err.detail = parsed.detail;
      throw err;
    }
    return res.json();
  },

  // Documents
  uploadSingle: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<any>("/api/v1/documents/upload", { method: "POST", body: fd }, 60000);
  },

  uploadBatch: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return request<any>("/api/v1/documents/upload/batch", { method: "POST", body: fd }, 120000);
  },

  uploadFolderZip: (file: File, folderName?: string) => {
    const fd = new FormData();
    fd.append("zip_file", file);
    if (folderName) fd.append("folder_name", folderName);
    return request<any>("/api/v1/documents/upload/folder-zip", { method: "POST", body: fd }, 120000);
  },

  getParsedDocument: (id: string) => request<any>(`/api/v1/documents/${id}/parsed`),

  suggestSchema: (id: string) =>
    request<any>(`/api/v1/documents/${id}/suggest-schema`, { method: "POST" }),

  // Schemas
  listSchemas: (page = 1, pageSize = 50) =>
    request<any>(`/api/v1/schemas?page=${page}&page_size=${pageSize}`),

  getSchema: (id: string) => request<any>(`/api/v1/schemas/${id}`),

  createSchema: (name: string, definition: any) =>
    request<any>("/api/v1/schemas", {
      method: "POST",
      body: JSON.stringify({ name, schema_definition: definition }),
    }),

  uploadSchema: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<any>("/api/v1/schemas/upload", { method: "POST", body: fd }, 60000);
  },

  schemaFromText: (text: string) =>
    request<any>("/api/v1/schemas/from-text", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  deleteSchema: (id: string) =>
    request<any>(`/api/v1/schemas/${id}`, { method: "DELETE" }),

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

  listSessions: (page = 1, pageSize = 50) =>
    request<any>(`/api/v1/sessions?page=${page}&page_size=${pageSize}`),

  getSession: (id: string) => request<any>(`/api/v1/sessions/${id}`),

  deleteSession: (id: string) =>
    request<any>(`/api/v1/sessions/${id}`, { method: "DELETE" }),

  // Extraction
  runExtraction: (
    sessionId: string,
    documentId: string,
    schemaId?: string,
    schemaDefinition?: Record<string, any>
  ) =>
    request<any>("/api/v1/extraction/run", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        document_id: documentId,
        ...(schemaId ? { schema_id: schemaId } : {}),
        ...(schemaDefinition ? { schema_definition: schemaDefinition } : {}),
      }),
    }, 180000),

  runBatchExtraction: (
    sessionId: string,
    documentIds: string[],
    schemaId?: string,
    schemaDefinition?: Record<string, any>
  ) =>
    request<any>("/api/v1/extraction/run-batch", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        document_ids: documentIds,
        ...(schemaId ? { schema_id: schemaId } : {}),
        ...(schemaDefinition ? { schema_definition: schemaDefinition } : {}),
      }),
    }, 300000),

  // Jobs
  listJobs: (page = 1, pageSize = 20) =>
    request<any>(`/api/v1/extraction/jobs?page=${page}&page_size=${pageSize}`),

  getJobResult: (id: string) =>
    request<any>(`/api/v1/extraction/results/${id}`),

  deleteJob: (id: string) =>
    request<any>(`/api/v1/extraction/jobs/${id}`, { method: "DELETE" }),

  // Aliases
  listAliases: () => request<any>("/api/v1/aliases"),

  getFieldAliases: (field: string) =>
    request<any>(`/api/v1/aliases/${field}`),

  addAlias: (data: any) =>
    request<any>("/api/v1/aliases/add", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approveAlias: (data: any) =>
    request<any>("/api/v1/aliases/approve", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeAlias: async (data: any) => {
    const res = await rawFetch("/api/v1/aliases/remove", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const parsed = await parseErrorResponse(res);
      const err = new Error(parsed.message) as Error & ApiError;
      err.status = parsed.status;
      err.detail = parsed.detail;
      throw err;
    }

    if (res.status === 204) return {};
    return res.json();
  },

  downloadAliasFile: () => rawFetch("/api/v1/aliases/download"),

  uploadAliasFile: (file: File, merge = true) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<any>(`/api/v1/aliases/upload?merge=${merge}`, {
      method: "POST",
      body: fd,
    }, 60000);
  },

  // Files
  listSchemaFiles: () => request<any>("/api/v1/files/schemas"),

  downloadSchemaFile: (fn: string) =>
    buildUrl(`/api/v1/files/schema/${fn}`),

  listResultFiles: () => request<any>("/api/v1/files/results"),

  downloadResultFile: (fn: string) =>
    buildUrl(`/api/v1/files/result/${fn}`),

  listExports: () => request<any>("/api/v1/files/exports"),

  downloadExport: (fn: string) =>
    buildUrl(`/api/v1/files/export/${fn}`),

  aliasMemoryFile: () => buildUrl("/api/v1/files/alias-memory"),

  // File save/edit
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

  saveAliasMemoryFile: (content: string) =>
    request<any>("/api/v1/files/alias-memory", {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  // Dashboard
  dashboardSummary: () => request<any>("/api/v1/dashboard/summary"),

  // Analytics
  getAnalyticsOverview: (limit = 300) =>
    request<any>(`/api/v1/analytics/overview?limit=${limit}`),

  getAnalyticsJobDetail: (jobId: string) =>
    request<any>(`/api/v1/analytics/job/${jobId}`),
};