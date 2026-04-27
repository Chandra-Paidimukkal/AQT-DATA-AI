import { create } from "zustand";

export type ExtractionMode = "auto" | "python" | "ai" | "hybrid";
export type SchemaSource = "upload" | "paste" | "existing" | "skip";

export interface UploadedDoc {
  document_id: string;
  filename: string;
  [key: string]: any;
}

export interface ProviderConfig {
  api_key?: string;
  model?: string;
  base_url?: string;
  [key: string]: any;
}

export interface WorkflowState {
  // stepper
  currentStep: number;
  setStep: (step: number) => void;

  // documents
  uploadedDocs: UploadedDoc[];
  addUploadedDocs: (docs: UploadedDoc[]) => void;
  clearUploadedDocs: () => void;

  selectedDocId: string | null;
  setSelectedDoc: (docId: string | null) => void;

  parsedContent: any;
  setParsedContent: (content: any) => void;

  // schema
  schemaSource: SchemaSource;
  setSchemaSource: (source: SchemaSource) => void;

  schemaValid: boolean;
  setSchemaValid: (valid: boolean) => void;

  schemaId: string;
  setSchemaId: (id: string) => void;

  schemaDefinition: any;
  setSchemaDefinition: (definition: any) => void;

  schemaName: string;
  setSchemaName: (name: string) => void;

  // session
  sessionMode: ExtractionMode;
  setSessionMode: (mode: ExtractionMode) => void;

  sessionProvider: string;
  setSessionProvider: (provider: string) => void;

  providerConfig: ProviderConfig;
  setProviderConfig: (config: ProviderConfig) => void;

  sessionCreated: boolean;
  setSessionCreated: (created: boolean) => void;

  sessionId: string;
  setSessionId: (sessionId: string) => void;

  // extraction
  extracting: boolean;
  setExtracting: (extracting: boolean) => void;

  extractionResult: any;
  extractionResultsByDoc: Record<string, any>;

  setExtractionResult: (result: any, docId?: string) => void;
  setExtractionResultsByDoc: (results: Record<string, any>) => void;
  clearExtractionResults: () => void;

  // full reset
  resetWorkflow: () => void;
}

const initialState = {
  currentStep: 0,

  uploadedDocs: [] as UploadedDoc[],
  selectedDocId: null as string | null,
  parsedContent: null,

  schemaSource: "skip" as SchemaSource,
  schemaValid: false,
  schemaId: "",
  schemaDefinition: null as any,
  schemaName: "",

  sessionMode: "auto" as ExtractionMode,
  sessionProvider: "groq",
  providerConfig: {} as ProviderConfig,
  sessionCreated: false,
  sessionId: "",

  extracting: false,
  extractionResult: null as any,
  extractionResultsByDoc: {} as Record<string, any>,
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initialState,

  // ── stepper ────────────────────────────────────────────────────────────────
  setStep: (step) =>
    set({
      currentStep: Math.max(0, Math.min(4, step)),
    }),

  // ── documents ──────────────────────────────────────────────────────────────
  addUploadedDocs: (docs) =>
    set((state) => {
      const incoming = Array.isArray(docs) ? docs : [];
      const mergedMap = new Map<string, UploadedDoc>();

      for (const doc of state.uploadedDocs) {
        if (doc?.document_id) mergedMap.set(doc.document_id, doc);
      }

      for (const doc of incoming) {
        if (doc?.document_id) mergedMap.set(doc.document_id, doc);
      }

      const mergedDocs = Array.from(mergedMap.values());

      return {
        uploadedDocs: mergedDocs,
        selectedDocId:
          state.selectedDocId ||
          mergedDocs[0]?.document_id ||
          null,
      };
    }),

  clearUploadedDocs: () =>
    set({
      uploadedDocs: [],
      selectedDocId: null,
      parsedContent: null,
    }),

  setSelectedDoc: (docId) =>
    set({
      selectedDocId: docId,
    }),

  setParsedContent: (content) =>
    set({
      parsedContent: content,
    }),

  // ── schema ─────────────────────────────────────────────────────────────────
  setSchemaSource: (source) =>
    set({
      schemaSource: source,
    }),

  setSchemaValid: (valid) =>
    set({
      schemaValid: valid,
    }),

  setSchemaId: (id) =>
    set({
      schemaId: id || "",
    }),

  setSchemaDefinition: (definition) =>
    set({
      schemaDefinition: definition,
    }),

  setSchemaName: (name) =>
    set({
      schemaName: name || "",
    }),

  // ── session ────────────────────────────────────────────────────────────────
  setSessionMode: (mode) =>
    set({
      sessionMode: mode,
    }),

  setSessionProvider: (provider) =>
    set({
      sessionProvider: provider || "groq",
    }),

  setProviderConfig: (config) =>
    set({
      providerConfig: config || {},
    }),

  setSessionCreated: (created) =>
    set({
      sessionCreated: created,
    }),

  setSessionId: (sessionId) =>
    set({
      sessionId: sessionId || "",
    }),

  // ── extraction ─────────────────────────────────────────────────────────────
  setExtracting: (extracting) =>
    set({
      extracting,
    }),

  setExtractionResult: (result, docId) =>
    set((state) => {
      // backward compatible: old code can still call with 1 arg
      if (!docId) {
        return {
          extractionResult: result,
        };
      }

      return {
        extractionResult: result,
        extractionResultsByDoc: {
          ...state.extractionResultsByDoc,
          [docId]: result,
        },
      };
    }),

  setExtractionResultsByDoc: (results) =>
    set({
      extractionResultsByDoc: results || {},
    }),

  clearExtractionResults: () =>
    set({
      extractionResult: null,
      extractionResultsByDoc: {},
      extracting: false,
    }),

  // ── full reset ─────────────────────────────────────────────────────────────
  resetWorkflow: () =>
    set({
      ...initialState,
    }),
}));