# it_llm — AI Desktop Assistant

Tauri 2 + React + TypeScript floating overlay that captures the screen, sends it to a local vision LLM, and returns a one-step instruction toward a goal. Styled as a Wispr Flow-style dark pill.

## Stack

- **Shell:** Tauri 2 (Rust backend, WebView frontend)
- **Frontend:** React 18, TypeScript, Vite
- **Screen capture:** `xcap 0.9` crate (do NOT use 0.0.x — type inference bug on macOS)
- **LLM client:** OpenAI npm SDK pointed at Ollama's OpenAI-compatible endpoint
- **Default model:** `gemma4:e2b` via Ollama at `http://localhost:11434/v1`

## File Map

| File | Role |
|---|---|
| `src-tauri/src/lib.rs` | `capture_screen` Tauri command — captures primary monitor, resizes to ≤1280px, returns base64 JPEG |
| `src-tauri/tauri.conf.json` | Window config: transparent, no decorations, always-on-top, `macOSPrivateApi: true` |
| `src-tauri/Cargo.toml` | Rust deps: `xcap = "0.9"`, `image = "0.25"`, `base64 = "0.22"` |
| `src/App.tsx` | State machine: idle → 3s countdown → capturing → thinking → done/error |
| `src/App.css` | Dark pill UI: `rgba(20,20,24,0.92)` + `backdrop-filter: blur(24px)` |
| `src/main.tsx` | React root mount — no StrictMode |
| `src/services/llmService.ts` | `LLMService` class with `getNextStep(base64)` and `updateConfig()` |

## Key Implementation Details

### Screenshot encoding
Full-resolution PNG from a Retina display is 10MB+ as base64 — too large for local LLMs. The Rust command resizes to max 1280px wide and encodes as JPEG (~150–300KB). The `image_url` MIME type in `llmService.ts` must be `data:image/jpeg`, not `data:image/png`.

### Empty response handling
Ollama returns `content: ""` (empty string, not null) when it fails silently. Use `||` not `??` as the fallback operator. The model also exposes a `reasoning` field (thinking mode) — fall back to that before showing a generic error:
```ts
msg?.content?.trim() || msg?.reasoning?.trim() || 'Unable to determine next step.'
```

### Token budget
`gemma4:e2b` uses thinking/reasoning tokens before writing `content`. At `max_tokens: 150` it runs out mid-thought and returns empty content. Set `max_tokens: 2048`.

### Capture timing
The user must click the button to trigger capture, which focuses the Tauri window. A 3-second countdown (`Capturing in 3… 2… 1…`) gives time to switch to the target window before the screenshot fires.

### macOS transparency
`macOSPrivateApi: true` is required in `tauri.conf.json` under `app`. Without it the window background renders white despite `transparent: true` in the window config.

### Swapping the model
To change model or endpoint, call `llmService.updateConfig()` at runtime or edit `DEFAULT_CONFIG` in `src/services/llmService.ts`:
```ts
llmService.updateConfig({ baseURL: 'https://api.openai.com/v1', apiKey: 'sk-...', model: 'gpt-4o' });
```

## Running Locally

```bash
# Terminal 1 — LLM backend (Ollama must already be running)
ollama pull gemma4:e2b

# Terminal 2 — App
npm run tauri dev
```

Ollama starts automatically on macOS after install and listens on port 11434. If `ollama serve` errors with "address already in use", it's already running — skip it.

## Known Limitations

- `gemma4:e2b` (2B) passes vision capability checks but is too small for reliable desktop screenshot interpretation. It correctly identifies visual elements in its reasoning but then overrides its own observations and defaults to safe/early instructions. **Recommended upgrade: `gemma4:12b`.**
- Neither RAG nor fine-tuning fixes this — it's an architectural capacity issue in the visual encoder, not a knowledge or pattern problem.
- The system prompt is currently hardcoded to guide the user to open Chrome and navigate to Facebook. To make it task-agnostic, the instruction should be passed in as a parameter.

## Detailed History

See `knowledge_base.md` for the full decision log with rationale.
