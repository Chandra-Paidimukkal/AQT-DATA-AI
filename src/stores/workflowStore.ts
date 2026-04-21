import { create } from "zustand";

export type ExtractionMode = "auto" | "python" | "ai" | "hybrid";
export type SchemaSource = "upload" | "paste" | "existing" | "skip";

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
  parsedContent: any | null;
  parsedForDocId: string;            // which doc the parsedContent belongs to
  parsedCache: Record<string, any>;  // per-doc cache: docId → parsed data

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

  setStep: (step: number) => void;
  addUploadedDocs: (docs: UploadedDoc[]) => void;
  setSelectedDoc: (id: string) => void;
  setParsedContent: (content: any, docId: string) => void;
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
  resetWorkflow: () => void;
}

const initialState = {
  currentStep: 0,
  uploadedDocs: [],
  selectedDocId: "",
  parsedContent: null,
  parsedForDocId: "",
  parsedCache: {},
  schemaSource: "skip" as SchemaSource,
  schemaId: "",
  schemaDefinition: null,
  schemaName: "",
  schemaValid: false,
  sessionMode: "auto" as ExtractionMode,
  sessionProvider: "groq",
  providerConfig: {},
  sessionId: "",
  sessionCreated: false,
  extractionResult: null,
  extracting: false,
};

export const useWorkflowStore = create<WorkflowState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),

  addUploadedDocs: (docs) =>
    set((s) => ({ uploadedDocs: [...s.uploadedDocs, ...docs] })),

  // BUG FIX: When selecting a different doc, restore its cached parse result
  // (or clear parsedContent if it hasn't been parsed yet). This prevents
  // doc A's parsed content from showing when doc B is selected.
  setSelectedDoc: (id) =>
    set((s) => ({
      selectedDocId: id,
      parsedContent: s.parsedCache[id] ?? null,
      parsedForDocId: s.parsedCache[id] ? id : "",
    })),

  // BUG FIX: setParsedContent now requires docId so we know which doc it belongs to
  // and can cache it per-doc.
  setParsedContent: (content, docId) =>
    set((s) => ({
      parsedContent: content,
      parsedForDocId: docId,
      parsedCache: { ...s.parsedCache, [docId]: content },
    })),

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
  setExtracting: (extracting) => set({ extracting: extracting }),
  resetWorkflow: () => set(initialState),
}));