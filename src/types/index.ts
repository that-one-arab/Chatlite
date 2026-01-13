export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  model: string;
}

export interface Settings {
  storagePath: string;
  lastModel: string;
}
