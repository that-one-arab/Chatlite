export interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  timestamp?: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  systemPrompt?: string;
}

export interface Settings {
  storagePath: string;
  lastModel: string;
  zoomLevel?: number;
}
