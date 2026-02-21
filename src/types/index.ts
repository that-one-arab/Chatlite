export interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  timestamp?: number;
  images?: string[];  // Array of data URLs for displaying images
}

export interface ChatMetadataEntry {
  id: string;
  title: string;
  model: string;
  lastModified: number;
  messageCount: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  systemPrompt?: string;
  createdAt: number;
  lastModified: number;
}

export interface Settings {
  storagePath: string;
  lastModel: string;
  zoomLevel?: number;
  theme?: "light" | "dark" | "blue";
  passwordEnabled?: boolean;
}

export interface AttachedImage {
  id: string;           // Unique identifier
  base64: string;       // Base64 data (without data URI prefix)
  dataUrl: string;      // Full data URL for validation
  name: string;         // "Image 1", "Image 2", etc.
}
