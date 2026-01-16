import { createContext } from "preact";
import { useContext, useState, useCallback } from "preact/hooks";

interface ModelContextValue {
  models: string[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  fetchModels: (lastModel?: string) => Promise<void>;
}

const ModelContext = createContext<ModelContextValue | null>(null);

export function ModelProvider({ children }: { children: preact.ComponentChildren }) {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  const fetchModels = useCallback(async (lastModel?: string) => {
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const modelNames = data.models?.map((m: { name: string }) => m.name) || [];

      setModels(modelNames);

      // Set selected model
      if (lastModel && modelNames.includes(lastModel)) {
        setSelectedModel(lastModel);
      } else if (modelNames.length > 0) {
        setSelectedModel(modelNames[0]);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
      setModels([]);
    }
  }, []);

  const value: ModelContextValue = {
    models,
    selectedModel,
    setSelectedModel,
    fetchModels,
  };

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

export function useModelContext() {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error("useModelContext must be used within ModelProvider");
  }
  return context;
}
