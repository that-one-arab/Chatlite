import { invoke } from "@tauri-apps/api/core";
import { Chat, ChatMetadataEntry } from "../types";

class ChatStorageService {
  async initializeStorage(storagePath: string): Promise<void> {
    try {
      await invoke("initialize_storage", { storagePath });
    } catch (error) {
      console.error("Failed to initialize storage:", error);
      throw new Error(`Storage initialization failed: ${error}`);
    }
  }

  async loadMetadata(storagePath: string): Promise<ChatMetadataEntry[]> {
    try {
      const metadata = await invoke<ChatMetadataEntry[]>("load_chat_metadata", {
        storagePath,
      });
      return metadata;
    } catch (error) {
      console.error("Failed to load chat metadata:", error);
      throw new Error(`Failed to load chat metadata: ${error}`);
    }
  }

  async loadChat(storagePath: string, chatId: string): Promise<Chat> {
    try {
      const chat = await invoke<Chat>("load_chat_by_id", {
        storagePath,
        chatId,
      });
      return chat;
    } catch (error) {
      console.error(`Failed to load chat ${chatId}:`, error);
      throw new Error(`Failed to load chat: ${error}`);
    }
  }

  async saveChat(storagePath: string, chat: Chat): Promise<void> {
    try {
      await invoke("save_chat_data", {
        storagePath,
        chat,
      });
    } catch (error) {
      console.error(`Failed to save chat ${chat.id}:`, error);
      throw new Error(`Failed to save chat: ${error}`);
    }
  }

  async deleteChat(storagePath: string, chatId: string): Promise<void> {
    try {
      await invoke("delete_chat_data", {
        storagePath,
        chatId,
      });
    } catch (error) {
      console.error(`Failed to delete chat ${chatId}:`, error);
      throw new Error(`Failed to delete chat: ${error}`);
    }
  }
}

export const chatStorage = new ChatStorageService();
