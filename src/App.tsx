import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { llmService } from "./services";
import "./App.css";

type Status = "idle" | "capturing" | "thinking" | "done" | "error";

function App() {
  const [instruction, setInstruction] = useState<string>(
    "Click the button to analyze your screen and get the next step."
  );
  const [status, setStatus] = useState<Status>("idle");
  const [stepCount, setStepCount] = useState(0);

  const handleAnalyze = useCallback(async () => {
    const win = getCurrentWindow();
    try {
      setStatus("capturing");
      setInstruction("Capturing…");

      // Hide so the overlay doesn't appear in the screenshot
      await win.hide();
      await new Promise((r) => setTimeout(r, 150));

      const screenshot = await invoke<string>("capture_screen");

      await win.show();
      await win.setFocus();

      setStatus("thinking");
      setInstruction("Analyzing… (first request may take up to 3 minutes while the server boots)");

      const nextStep = await llmService.getNextStep(screenshot);

      setStepCount((n) => n + 1);
      setInstruction(nextStep);
      setStatus(nextStep.toLowerCase().includes("task complete") ? "done" : "idle");
    } catch (err) {
      await win.show();
      setStatus("error");
      setInstruction(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const isLoading = status === "capturing" || status === "thinking";

  return (
    <div className="assistant-container">
      <div className="assistant-card">
        <div className="assistant-header">
          <div className="status-dot" data-status={status} />
          <span className="assistant-title">AI Assistant</span>
          {stepCount > 0 && (
            <span className="step-badge">Step {stepCount}</span>
          )}
        </div>

        <p className="instruction-text">{instruction}</p>

        <button
          className="analyze-btn"
          onClick={handleAnalyze}
          disabled={isLoading}
        >
          {isLoading
            ? status === "capturing"
              ? "Capturing…"
              : "Thinking…"
            : status === "done"
            ? "Analyze Again"
            : "Analyze Screen"}
        </button>
      </div>
    </div>
  );
}

export default App;
