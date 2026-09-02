type PwnyMarketWebMcpTool = {
  annotations?: {
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    readOnlyHint?: boolean;
  };
  description: string;
  execute: (input: { choice: 'yes' | 'no' }) => Promise<unknown>;
  inputSchema: object;
  name: string;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: PwnyMarketWebMcpTool,
        options?: { signal?: AbortSignal },
      ) => void;
    };
  }
}

export {};
