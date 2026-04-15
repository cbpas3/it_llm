# AI Desktop Assistant

A floating, always-on-top desktop overlay that captures your screen and uses a local vision LLM to guide you step-by-step toward a goal.

Built with Tauri 2, React, and TypeScript. Styled as a minimal dark pill inspired by Wispr Flow.

---

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (stable)
- [Ollama](https://ollama.com) for running the local LLM

---

## Setup

### 1. Install Ollama

Download from [ollama.com](https://ollama.com) or via Homebrew:

```bash
brew install ollama
```

Ollama starts automatically on macOS after install. If you ever need to start it manually:

```bash
ollama serve
```

> If you see `address already in use`, Ollama is already running — skip this step.

### 2. Pull the model

```bash
ollama pull gemma4:e2b
```

> `gemma4:e2b` is a 2B vision model. It works for simple tasks but struggles with complex desktop screenshots. For better accuracy, use `gemma4:12b` (larger download).

### 3. Install dependencies

```bash
npm install
```

### 4. Run the app

```bash
npm run tauri dev
```

The floating assistant window will appear on screen.

---

## Usage

1. Click **Analyze Screen**
2. A 3-second countdown starts — switch to the window you want analyzed before it fires
3. The assistant captures your screen, sends it to the local LLM, and returns the next instruction
4. Follow the instruction, then click **Analyze Screen** again for the next step

---

## Switching Models

Edit `src/services/llmService.ts` and update `DEFAULT_CONFIG`:

```ts
const DEFAULT_CONFIG: LLMConfig = {
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  model: 'gemma4:12b', // change this
};
```

To use a cloud model instead:

```ts
const DEFAULT_CONFIG: LLMConfig = {
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'sk-your-key-here',
  model: 'gpt-4o',
};
```

---

## Building for Production

```bash
npm run tauri build
```

The signed app bundle will be output to `src-tauri/target/release/bundle/`.
