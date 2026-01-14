import { useState } from "preact/hooks";

export function useModels() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  const fetchModels = async (currentModel?: string) => {
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      const data = await response.json();
      const modelNames = data.models.map((m: any) => m.name);
      setModels(modelNames);

      // Only auto-select if no model is set (use currentModel to avoid stale closure)
      const modelToCheck = currentModel ?? selectedModel;
      if (!modelToCheck && modelNames.length > 0) {
        setSelectedModel(modelNames[0]);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
  };

  return {
    models,
    selectedModel,
    setSelectedModel,
    fetchModels,
  };
}
