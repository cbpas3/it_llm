import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { llmService } from "./services";
import "./App.css";

type Status = "idle" | "capturing" | "thinking" | "done" | "error";

function App() {
  const [instruction, setInstruction] = useState<string>(
    "Click the button below to analyze your screen and get the next step."
  );
  const [status, setStatus] = useState<Status>("idle");
  const [stepCount, setStepCount] = useState(0);

  const handleAnalyze = useCallback(async () => {
    try {
      // Countdown so the user can switch to the target window before capture
      for (let i = 3; i >= 1; i--) {
        setStatus("capturing");
        setInstruction(`Capturing in ${i}…`);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setInstruction("Capturing your screen...");

      const screenshot = await invoke<string>("capture_screen");

      setStatus("thinking");
      setInstruction("Analyzing screenshot...");

      const nextStep = await llmService.getNextStep(screenshot);

      setStepCount((n) => n + 1);
      setInstruction(nextStep);

      if (nextStep.toLowerCase().includes("task complete")) {
        setStatus("done");
      } else {
        setStatus("idle");
      }
    } catch (err) {
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
              ? "Capturing..."
              : "Thinking..."
            : status === "done"
            ? "Analyze Again"
            : "Analyze Screen"}
        </button>
      </div>
    </div>
  );
}

export default App;
