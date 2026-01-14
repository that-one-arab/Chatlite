# LLM Chat Frontend

Desktop chat interface for Ollama models. Built with Tauri + Preact + Tailwind.

## Architecture

**Stack**: Tauri (Rust), Preact, Tailwind CSS, Ollama API

**Structure**: Modular component-based architecture with path aliases (`@/`)

```
src/
├── types/index.ts           # TypeScript interfaces
├── hooks/
│   ├── useModels.ts         # Model fetching & selection
│   └── useAutoScroll.ts     # Auto-scroll during streaming
├── components/
│   ├── Sidebar.tsx          # Chat list + model selector
│   ├── ChatArea.tsx         # Messages + input area
│   ├── Message.tsx          # Message display + edit + thinking
│   ├── EmptyState.tsx       # No chat selected view
│   ├── SettingsModal.tsx    # App settings dialog
│   └── ChatSettingsModal.tsx # Per-conversation settings
└── App.tsx                  # Main orchestrator (~300 lines)
```

## Features

### Chat Management
- Multiple conversations with persistent history
- Auto-titled via LLM based on first message topic (max 50 chars)
- Per-conversation system prompt (via settings icon in chat header)
- Delete conversations
- Stored in `chats.json` at configurable path

### Model Selection
- Fetches available models from Ollama (`http://localhost:11434/api/tags`)
- Each chat remembers its model
- Switching chats auto-selects that chat's model
- Last selected model persisted globally in `settings.json`

### Streaming
- Ollama `/api/chat` endpoint with `stream: true`
- Markdown rendered live via `markdown-to-jsx`
- Thinking indicator and collapsible thinking tokens display (for reasoning models)
- Stop generation button (AbortController)

### Messages
- User messages editable (triggers regeneration from that point)
- Copy button on assistant messages
- Markdown code blocks with syntax styling

### Auto-scroll Behavior
- Enabled by default when generating
- Breaks when user scrolls up (wheel deltaY < 0)
- Re-enables when user scrolls back to bottom (<50px from bottom)
- Resets on new message

## Data Model

```typescript
Chat {
  id: string          // timestamp
  title: string       // LLM-generated title from first message
  messages: Message[]
  model: string       // ollama model name
  systemPrompt?: string
}

Message {
  role: "user" | "assistant"
  content: string
  thinking?: string
}

Settings {
  storagePath: string
  lastModel: string
}
```

## File Structure
- `chats.json` - All conversations
- `settings.json` - App config (in app data dir)
- Storage path configurable via settings modal
