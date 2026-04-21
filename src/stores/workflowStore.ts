import { create } from "zustand";

export type ExtractionMode = "auto" | "python" | "ai" | "hybrid";
export type SchemaSource = "upload" | "paste" | "existing" | "skip";
export type ParseStatus = "idle" | "parsing" | "done" | "error";

export interface UploadedDoc {
  document_id: string;
  filename: string;
  file_type?: string;
  file_size?: number;
  uploaded_at?: string;
  parsed?: boolean;
}

export interface ProviderConfig {
  api_key?: string;
  model?: string;
  base_url?: string;
}

export interface WorkflowState {
  currentStep: number;
  uploadedDocs: UploadedDoc[];
  selectedDocId: string;
  parseStatuses: Record<string, ParseStatus>;
  parseResults: Record<string, any>;
  parseErrors: Record<string, string>;
  parsedContent: any | null;
  schemaSource: SchemaSource;
  schemaId: string;
  schemaDefinition: Record<string, any> | null;
  schemaName: string;
  schemaValid: boolean;
  sessionMode: ExtractionMode;
  sessionProvider: string;
  providerConfig: ProviderConfig;
  sessionId: string;
  sessionCreated: boolean;
  extractionResult: any | null;
  extracting: boolean;
  batchExtractionResults: Record<string, any>;
  batchExtracting: boolean;
  batchProgress: { done: number; total: number };

  setStep: (step: number) => void;
  addUploadedDocs: (docs: UploadedDoc[]) => void;
  setSelectedDoc: (id: string) => void;
  setParsedContent: (content: any) => void;
  setParseStatus: (docId: string, status: ParseStatus, result?: any, error?: string) => void;
  clearParseStates: () => void;
  setSchemaSource: (source: SchemaSource) => void;
  setSchemaId: (id: string) => void;
  setSchemaDefinition: (def: Record<string, any> | null) => void;
  setSchemaName: (name: string) => void;
  setSchemaValid: (valid: boolean) => void;
  setSessionMode: (mode: ExtractionMode) => void;
  setSessionProvider: (provider: string) => void;
  setProviderConfig: (config: ProviderConfig) => void;
  setSessionId: (id: string) => void;
  setSessionCreated: (created: boolean) => void;
  setExtractionResult: (result: any) => void;
  setExtracting: (extracting: boolean) => void;
  setBatchExtractionResult: (docId: string, result: any) => void;
  setBatchExtracting: (val: boolean) => void;
  setBatchProgress: (progress: { done: number; total: number }) => void;
  resetWorkflow: () => void;
}

const initialState = {
  currentStep: 0,
  uploadedDocs: [] as UploadedDoc[],
  selectedDocId: "",
  parseStatuses: {} as Record<string, ParseStatus>,
  parseResults: {} as Record<string, any>,
  parseErrors: {} as Record<string, string>,
  parsedContent: null,
  schemaSource: "skip" as SchemaSource,
  schemaId: "",
  schemaDefinition: null,
  schemaName: "",
  schemaValid: false,
  sessionMode: "auto" as ExtractionMode,
  sessionProvider: "groq",
  providerConfig: {} as ProviderConfig,
  sessionId: "",
  sessionCreated: false,
  extractionResult: null,
  extracting: false,
  batchExtractionResults: {} as Record<string, any>,
  batchExtracting: false,
  batchProgress: { done: 0, total: 0 },
};

export const useWorkflowStore = create<WorkflowState>((set) => ({
  ...initialState,
  setStep: (step) => set({ currentStep: step }),
  addUploadedDocs: (docs) =>
    set((s) => ({ uploadedDocs: [...s.uploadedDocs, ...docs] })),
  setSelectedDoc: (id) => set({ selectedDocId: id }),
  setParsedContent: (content) => set({ parsedContent: content }),

  setParseStatus: (docId, status, result, error) =>
    set((s) => ({
      parseStatuses: { ...s.parseStatuses, [docId]: status },
      parseResults:
        result !== undefined ? { ...s.parseResults, [docId]: result } : s.parseResults,
      parseErrors:
        error !== undefined ? { ...s.parseErrors, [docId]: error } : s.parseErrors,
      parsedContent:
        result !== undefined && docId === s.selectedDocId ? result : s.parsedContent,
    })),

  clearParseStates: () =>
    set({ parseStatuses: {}, parseResults: {}, parseErrors: {} }),

  setSchemaSource: (source) => set({ schemaSource: source }),
  setSchemaId: (id) => set({ schemaId: id }),
  setSchemaDefinition: (def) => set({ schemaDefinition: def }),
  setSchemaName: (name) => set({ schemaName: name }),
  setSchemaValid: (valid) => set({ schemaValid: valid }),
  setSessionMode: (mode) => set({ sessionMode: mode }),
  setSessionProvider: (provider) => set({ sessionProvider: provider }),
  setProviderConfig: (config) => set({ providerConfig: config }),
  setSessionId: (id) => set({ sessionId: id }),
  setSessionCreated: (created) => set({ sessionCreated: created }),
  setExtractionResult: (result) => set({ extractionResult: result }),
  setExtracting: (extracting) => set({ extracting }),
  setBatchExtractionResult: (docId, result) =>
    set((s) => ({
      batchExtractionResults: { ...s.batchExtractionResults, [docId]: result },
    })),
  setBatchExtracting: (val) => set({ batchExtracting: val }),
  setBatchProgress: (progress) => set({ batchProgress: progress }),
  resetWorkflow: () => set(initialState),
}));