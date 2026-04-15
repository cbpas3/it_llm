# IT LLM — Knowledge Base

A running log of every decision made during development of this Tauri-based AI desktop assistant.

---

## Project Overview

A floating, always-on-top desktop assistant built with Tauri 2 + React + TypeScript. It captures a screenshot, sends it to a local vision LLM via an OpenAI-compatible API, and returns a one-step instruction toward a goal. Designed to resemble the Wispr Flow floating pill UI.

---

## Steps & Decisions

### 1. Project scaffold — Tauri 2 + React + TypeScript

**Decision:** Use Tauri 2 as the desktop shell rather than Electron.  
**Rationale:** Smaller binary, native Rust backend for system-level operations (screen capture), no bundled Chromium.

---

### 2. Screen capture — xcap crate

**Decision:** Use `xcap` for cross-platform monitor capture in Rust.  
**Rationale:** Simple API (`Monitor::all()` → `capture_image()`), cross-platform, returns an `RgbaImage` compatible with the `image` crate.

**Problem encountered:** `xcap 0.0.14` failed to compile on macOS with:
```
error[E0282]: type annotations needed
  --> xcap-0.0.14/src/macos/boxed.rs:22:41
```
This is a type inference bug in that specific release.

**Fix:** Bumped to `xcap = "0.9"` (latest stable at time of development, resolves to 0.9.4). The 0.x versioning jumped significantly — versions 0.0.x and 0.9.x are not contiguous; 0.9.4 was the current latest on crates.io.

---

### 3. Image encoding — PNG → JPEG + resize

**Initial approach:** Capture full-resolution PNG, base64-encode, send to LLM.  
**Problem:** A Retina display screenshot encodes to 10MB+ as base64 PNG. Ollama was silently returning empty `content` strings — the payload was too large for the local model to process.

**Fix:**
- Resize to max 1280px wide using `image::imageops::FilterType::Lanczos3`
- Re-encode as JPEG instead of PNG
- Result: ~150–300KB base64 payload instead of 10MB+

**MIME type:** Updated the `image_url` data URL prefix in `llmService.ts` from `data:image/png` to `data:image/jpeg` to match.

---

### 4. LLM service — OpenAI SDK pointing at Ollama

**Decision:** Use the `openai` npm package with `baseURL: 'http://localhost:11434/v1'` rather than hitting Ollama's native API directly.  
**Rationale:** Ollama exposes an OpenAI-compatible endpoint. Using the OpenAI SDK means the `baseURL` can be hot-swapped to any cloud provider (OpenAI, Gemini, etc.) by changing one config value. `dangerouslyAllowBrowser: true` is required because Tauri's webview is treated as a browser context.

---

### 5. Model — gemma4:e2b

**Decision:** Use `gemma4:e2b` (Google Gemma 4, 2B parameter edge variant) via Ollama.  
**Ollama tag:** `gemma4:e2b` (confirmed at https://ollama.com/library/gemma4:e2b)  
**Capabilities reported by `ollama show gemma4:e2b`:** completion, vision, audio, tools, thinking.

**Initial mistake:** The LLM service was scaffolded with `gemma3:4b` (wrong model family and generation). Corrected to `gemma4:e2b`.

---

### 6. Empty response bug — max_tokens and fallback

**Problem:** The model was returning `content: ""` with all output in the `reasoning` field. `finish_reason: "length"` confirmed it hit the token limit mid-thought (at 150 tokens) and never wrote the actual response.

**Fix 1:** Raised `max_tokens` from 150 → 2048 so the model has room to finish reasoning and write content.

**Fix 2:** Changed the fallback from `?? 'Unable to determine next step.'` to `|| 'Unable to determine next step.'`. The `??` operator only catches `null`/`undefined`; Ollama returns `""` (empty string) in some failure modes, which `??` does not catch but `||` does.

**Fix 3:** Added `msg?.reasoning?.trim()` as a secondary fallback — if `content` is still empty, surface the reasoning text rather than a generic error message.

---

### 7. Window configuration — transparent floating overlay

**Settings applied in `tauri.conf.json`:**
- `transparent: true` — removes the white window background
- `decorations: false` — hides the title bar and window chrome
- `alwaysOnTop: true` — keeps the assistant visible over other apps
- `width: 420, height: 220, resizable: false` — fixed pill size
- `macOSPrivateApi: true` — **required** for transparency to work on macOS; without it Tauri logs a warning and the window background renders white instead of transparent

**CSS:** `backdrop-filter: blur(24px) saturate(180%)` on the card element creates the frosted glass effect. Requires `body { background: transparent }`.

---

### 8. Capture timing — 3-second countdown

**Problem:** The user must click "Analyze Screen" to trigger capture, which brings the Tauri window into focus. The resulting screenshot captures the Tauri overlay as the foreground element rather than the target application (e.g., Chrome).

**Fix:** Added a 3-second countdown (`Capturing in 3… 2… 1…`) before `invoke("capture_screen")` fires. This gives the user time to click away to the target window before the screenshot is taken.

---

### 9. System prompt — task completion detection

**Initial prompt:** Simple instruction to guide the user to Facebook, with "say 'Task complete' when done."

**Problem:** The model kept issuing the same instruction even after the goal was achieved. It wasn't grounding itself in the current screenshot state before deciding what to say.

**Revised prompt structure:**
1. Explicitly instruct the model to examine the screenshot state FIRST
2. List concrete visual signals for each state (address bar shows "facebook.com", Facebook logo visible, etc.)
3. Only then decide on an action

**Rationale:** Forcing an explicit state-check step before the action-selection step reduces the model's tendency to continue a scripted sequence regardless of what the screenshot shows.

---

### 10. gemma4:e2b (2B) vision limitations — discovered in testing

**Observed behavior:** The model correctly identified visual elements in its reasoning (e.g., *"The screenshot shows a window that appears to be a Facebook interface"*) but then overrode its own observation and output "Open Chrome." This happened even when Facebook was fully loaded and Chrome was the foreground window.

**Root cause:** At 2B parameters, the model's visual encoder lacks the capacity to confidently bridge visual observations to conclusions. When uncertain, it defaults to the safest/earliest instruction in the sequence. This is an architectural limitation — not a prompt or knowledge problem.

**What was ruled out:**

| Approach | Why it won't fix this |
|---|---|
| RAG | The model already has the knowledge. RAG retrieves text context; it can't improve visual grounding capacity. |
| Fine-tuning | Could partially fix the second-guessing pattern (the model overriding its own correct observations), but the visual encoder bottleneck is architectural. You'd need labeled screenshot datasets and the result would be fragile. Not worth the effort when a larger model solves it cleanly. |

**Recommended fix:** Switch to `gemma4:12b`. The 12B model has substantially better visual grounding and reliably commits to what it observes in the screenshot.

```bash
ollama pull gemma4:12b
```

Update `src/services/llmService.ts` line 12:
```ts
model: 'gemma4:12b',
```

---

## File Map

| File | Purpose |
|---|---|
| `src-tauri/src/lib.rs` | Rust backend: `capture_screen` Tauri command |
| `src-tauri/tauri.conf.json` | Window config: transparency, always-on-top, macOSPrivateApi |
| `src-tauri/Cargo.toml` | Rust dependencies: xcap 0.9, image 0.25, base64 0.22 |
| `src/App.tsx` | Main React component: state machine, countdown, LLM orchestration |
| `src/App.css` | Wispr Flow-style dark pill UI with backdrop blur |
| `src/main.tsx` | React root mount (no StrictMode) |
| `src/services/llmService.ts` | OpenAI-SDK wrapper for Ollama; configurable baseURL/model |
