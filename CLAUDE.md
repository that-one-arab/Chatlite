# LLM Chat Frontend

Desktop chat interface for Ollama models. Built with Tauri + Preact + Tailwind.

## Architecture

**Stack**: Tauri (Rust), Preact, Tailwind CSS, Ollama API

## Features

### Chat Management
- Multiple conversations with persistent history
- Auto-titled from first message (30 chars)
- Delete conversations
- Stored in `chats.json` at configurable path

### Model Selection
- Fetches available models from Ollama (`http://localhost:11434/api/tags`)
- Each chat remembers its model
- Switching chats auto-selects that chat's model
- Last selected model persisted globally in `settings.json`

### Streaming
- Raw streaming (no markdown parsing)
- Ollama `/api/chat` endpoint with `stream: true`
- Stop generation button (AbortController)

### Auto-scroll Behavior
- Enabled by default when generating
- Breaks when user scrolls up (wheel deltaY < 0)
- Re-enables when user scrolls back to bottom (<50px from bottom)
- Resets on new message

## Data Model

```typescript
Chat {
  id: string          // timestamp
  title: string       // first 30 chars of first message
  messages: Message[]
  model: string       // ollama model name
}

Message {
  role: "user" | "assistant"
  content: string
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
