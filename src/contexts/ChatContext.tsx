import { createContext } from "preact";
import { useContext, useState, useCallback } from "preact/hooks";
import type { Chat, Message, ChatMetadataEntry } from "@/types";

interface ChatContextValue {
  chatMetadata: ChatMetadataEntry[];
  loadedChats: Map<string, Chat>;
  currentChatId: string | null;
  currentChat: Chat | null;
  setChatMetadata: (metadata: ChatMetadataEntry[]) => void;
  setLoadedChats: (chats: Map<string, Chat>) => void;
  createChat: (model: string) => string;
  deleteChat: (chatId: string) => void;
  selectChat: (chatId: string | null) => void;
  updateChatMessages: (chatId: string, messages: Message[]) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  updateSystemPrompt: (chatId: string, systemPrompt: string) => void;
  refreshMetadata: (metadata: ChatMetadataEntry[]) => void;
  loadChatIntoMemory: (chat: Chat) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: preact.ComponentChildren }) {
  const [chatMetadata, setChatMetadata] = useState<ChatMetadataEntry[]>([]);
  const [loadedChats, setLoadedChats] = useState<Map<string, Chat>>(new Map());
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const currentChat = currentChatId ? loadedChats.get(currentChatId) || null : null;

  const loadChatIntoMemory = useCallback((chat: Chat) => {
    setLoadedChats((prev) => {
      const newMap = new Map(prev);
      newMap.set(chat.id, chat);
      return newMap;
    });
  }, []);

  const createChat = useCallback((model: string): string => {
    const now = Date.now();
    const newChat: Chat = {
      id: now.toString(),
      title: "New Chat",
      messages: [],
      model,
      createdAt: now,
      lastModified: now,
    };

    // Add to loaded chats
    setLoadedChats((prev) => {
      const newMap = new Map(prev);
      newMap.set(newChat.id, newChat);
      return newMap;
    });

    // Add to metadata
    setChatMetadata((prev) => [
      {
        id: newChat.id,
        title: newChat.title,
        model: newChat.model,
        lastModified: newChat.lastModified,
        messageCount: 0,
      },
      ...prev,
    ]);

    setCurrentChatId(newChat.id);
    return newChat.id;
  }, []);

  const deleteChat = useCallback((chatId: string) => {
    // Remove from loaded chats
    setLoadedChats((prev) => {
      const newMap = new Map(prev);
      newMap.delete(chatId);
      return newMap;
    });

    // Remove from metadata
    setChatMetadata((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId);

      // Update current chat if we deleted it
      if (currentChatId === chatId) {
        if (filtered.length > 0) {
          setCurrentChatId(filtered[0].id);
        } else {
          setCurrentChatId(null);
        }
      }

      return filtered;
    });
  }, [currentChatId]);

  const selectChat = useCallback((chatId: string | null) => {
    setCurrentChatId(chatId);
  }, []);

  const updateChatMessages = useCallback((chatId: string, messages: Message[]) => {
    setLoadedChats((prev) => {
      const chat = prev.get(chatId);
      if (!chat) return prev;

      const newMap = new Map(prev);
      newMap.set(chatId, {
        ...chat,
        messages,
        lastModified: Date.now(),
      });
      return newMap;
    });

    // Update metadata message count and lastModified
    setChatMetadata((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messageCount: messages.length, lastModified: Date.now() }
          : c
      )
    );
  }, []);

  const updateChatTitle = useCallback((chatId: string, title: string) => {
    setLoadedChats((prev) => {
      const chat = prev.get(chatId);
      if (!chat) return prev;

      const newMap = new Map(prev);
      newMap.set(chatId, {
        ...chat,
        title,
        lastModified: Date.now(),
      });
      return newMap;
    });

    // Update metadata
    setChatMetadata((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, title, lastModified: Date.now() }
          : c
      )
    );
  }, []);

  const updateSystemPrompt = useCallback((chatId: string, systemPrompt: string) => {
    setLoadedChats((prev) => {
      const chat = prev.get(chatId);
      if (!chat) return prev;

      const newMap = new Map(prev);
      newMap.set(chatId, {
        ...chat,
        systemPrompt,
        lastModified: Date.now(),
      });
      return newMap;
    });
  }, []);

  const refreshMetadata = useCallback((metadata: ChatMetadataEntry[]) => {
    setChatMetadata(metadata);
  }, []);

  const value: ChatContextValue = {
    chatMetadata,
    loadedChats,
    currentChatId,
    currentChat,
    setChatMetadata,
    setLoadedChats,
    createChat,
    deleteChat,
    selectChat,
    updateChatMessages,
    updateChatTitle,
    updateSystemPrompt,
    refreshMetadata,
    loadChatIntoMemory,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }
  return context;
}
