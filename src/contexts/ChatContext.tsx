import { createContext } from "preact";
import { useContext, useState, useCallback } from "preact/hooks";
import type { Chat, Message } from "@/types";

interface ChatContextValue {
  chats: Chat[];
  currentChatId: string | null;
  currentChat: Chat | null;
  setChats: (chats: Chat[]) => void;
  createChat: (model: string) => string;
  deleteChat: (chatId: string) => void;
  selectChat: (chatId: string | null) => void;
  updateChatMessages: (chatId: string, messages: Message[]) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  updateSystemPrompt: (chatId: string, systemPrompt: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: preact.ComponentChildren }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const currentChat = chats.find((c) => c.id === currentChatId) || null;

  const createChat = useCallback((model: string): string => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      model,
    };
    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    return newChat.id;
  }, []);

  const deleteChat = useCallback((chatId: string) => {
    setChats((prev) => {
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
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages } : c))
    );
  }, []);

  const updateChatTitle = useCallback((chatId: string, title: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title } : c))
    );
  }, []);

  const updateSystemPrompt = useCallback((chatId: string, systemPrompt: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, systemPrompt } : c))
    );
  }, []);

  const value: ChatContextValue = {
    chats,
    currentChatId,
    currentChat,
    setChats,
    createChat,
    deleteChat,
    selectChat,
    updateChatMessages,
    updateChatTitle,
    updateSystemPrompt,
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
