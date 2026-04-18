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
  // Step tracking
  currentStep: number;

  // Upload
  uploadedDocs: UploadedDoc[];
  selectedDocId: string;
  parsedContent: any | null;

  // Schema
  schemaSource: SchemaSource;
  schemaId: string;
  schemaDefinition: Record<string, any> | null;
  schemaName: string;
  schemaValid: boolean;

  // Session
  sessionMode: ExtractionMode;
  sessionProvider: string;
  providerConfig: ProviderConfig;
  sessionId: string;
  sessionCreated: boolean;

  // Extraction
  extractionResult: any | null;
  extracting: boolean;

  // Actions
  setStep: (step: number) => void;
  addUploadedDocs: (docs: UploadedDoc[]) => void;
  setSelectedDoc: (id: string) => void;
  setParsedContent: (content: any) => void;
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
  addUploadedDocs: (docs) => set((s) => ({ uploadedDocs: [...s.uploadedDocs, ...docs] })),
  setSelectedDoc: (id) => set({ selectedDocId: id }),
  setParsedContent: (content) => set({ parsedContent: content }),
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
