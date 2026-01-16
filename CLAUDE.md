# LLM Chat Frontend

Desktop chat interface for Ollama models. Built with Tauri + Preact + Tailwind.

## Architecture

**Stack**: Tauri (Rust), Preact, Tailwind CSS, Ollama API

**State Management**: Context API (no prop drilling)

```
src/
├── types/index.ts           # TypeScript interfaces
├── contexts/                # Global state (Context API)
│   ├── ChatContext.tsx      # Chats, messages, CRUD operations
│   ├── ModelContext.tsx     # Model list & selection
│   ├── UIContext.tsx        # Input, modals, zoom, streaming state
│   ├── NotificationContext.tsx # Toast notifications
│   └── index.tsx            # AppProviders wrapper
├── hooks/
│   ├── useAutoScroll.ts     # Auto-scroll during streaming
│   ├── useHotkeys.ts        # Global keyboard shortcuts
│   └── useToast.ts          # Toast notifications (legacy)
├── components/
│   ├── Sidebar.tsx          # Chat list (uses contexts)
│   ├── ChatArea.tsx         # Messages + input (uses contexts)
│   ├── Message.tsx          # Message display + edit
│   ├── EmptyState.tsx       # No chat selected view
│   ├── SettingsModal.tsx    # App settings dialog
│   ├── ChatSettingsModal.tsx # Per-conversation settings (uses contexts)
│   └── HelpModal.tsx        # Keyboard shortcuts reference
└── App.tsx                  # Provider setup + persistence
```

## State Management

**Context System** (eliminates prop drilling):
- **ChatContext**: `chats`, `currentChat`, `createChat()`, `deleteChat()`, `selectChat()`, `updateChatMessages()`, `updateChatTitle()`, `updateSystemPrompt()`
- **ModelContext**: `models`, `selectedModel`, `setSelectedModel()`, `fetchModels()`
- **UIContext**: `input`, `isStreaming`, `showSettings`, `showChatSettings`, `showHelp`, `zoomLevel`, `showZoomIndicator`, + setters/toggles
- **NotificationContext**: `toasts`, `showError()`, `showSuccess()`, `removeToast()`

**Data Flow**:
1. Components consume contexts via hooks (e.g., `useChatContext()`)
2. Context actions update state
3. App.tsx observes context state changes and persists to disk (Tauri APIs)

## UI Layout

**Sidebar** (left): Chat list + New Chat button + Settings button (app-level)

**Chat Header** (center/right):
- Model selector dropdown (center-aligned)
- Help (?) button (right)
- Conversation settings button (right)

**Chat Area** (main): Messages + input field + Send/Stop button

## Features

### Chat Management
- Multiple conversations with persistent history
- Auto-titled via LLM based on first message topic (max 50 chars)
- Per-conversation system prompt (via settings icon in chat header)
- Delete conversations
- Stored in `chats.json` at configurable path

### Model Selection
- Model selector dropdown located in chat header (center-aligned)
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
- Hover to show timestamp (time only if today, date + time otherwise)

### Auto-scroll Behavior
- Enabled by default when generating
- Breaks when user scrolls up (wheel deltaY < 0)
- Re-enables when user scrolls back to bottom (<50px from bottom)
- Resets on new message

### Keyboard Shortcuts
- `Cmd/Ctrl + K` - Focus message input
- `Cmd/Ctrl + N` - New conversation
- `Cmd/Ctrl + M` - Open model selector (in chat header)
- `Cmd/Ctrl + ,` - Open settings
- `Cmd/Ctrl + Shift + ,` - Conversation settings
- `Alt + ↑/↓` or `J/K` - Navigate between conversations
- `Cmd/Ctrl + /` - Show shortcuts help
- `Esc` - Close modal / blur input
- Help button (?) in chat header opens shortcuts reference

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
  timestamp?: number    // ms since epoch, displayed on hover
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
