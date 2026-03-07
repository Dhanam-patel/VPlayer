import { useMemo, useRef, useState } from "react";
import { normalizeAnalyzePayload } from "../utils/normalizeAnalyzePayload";

const NODE_LABELS = {
  input_classifier: "Classifying Input",
  story_expander: "Expanding Story",
  story_validator: "Validating Story",
  episode_planner: "Planning Episodes",
  episode_scripter: "Writing Scripts",
  emotional_arc_scorer: "Scoring Emotional Arc",
  cliffhanger_strength_scorer: "Scoring Cliffhangers",
  retention_risk_analyzer: "Analyzing Retention Risk",
  final_validator: "Final Validation",
  optimizer: "Optimizing",
};

const NODE_ORDER = [
  "input_classifier",
  "story_expander",
  "story_validator",
  "episode_planner",
  "episode_scripter",
  "emotional_arc_scorer",
  "cliffhanger_strength_scorer",
  "retention_risk_analyzer",
  "final_validator",
  "optimizer",
];

const TOTAL_STEPS = NODE_ORDER.length;

function friendlyLabel(rawNode) {
  if (!rawNode) return "";
  // Strip a trailing " (done)" if the raw value carried one
  const key = rawNode.replace(/\s*\(done\)$/i, "").trim();
  return NODE_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useStoryFlowStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeNode, setActiveNode] = useState("");
  const [rawThoughts, setRawThoughts] = useState("");
  const [nodeInsights, setNodeInsights] = useState({});
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState("");
  const [completedSteps, setCompletedSteps] = useState(0);
  const controllerRef = useRef(null);
  const completedNodesRef = useRef(new Set());

  const backendBaseUrl = useMemo(
    () => (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, ""),
    []
  );

  const stopStream = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleEvent = (eventType, dataString) => {
    if (!dataString) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(dataString);
    } catch {
      return;
    }

    if (eventType === "progress") {
      const node = payload?.node || "";
      const status = payload?.status || "";
      if (node) {
        if (status === "completed") {
          completedNodesRef.current.add(node);
          setCompletedSteps(completedNodesRef.current.size);
          setActiveNode(friendlyLabel(node) ? `${friendlyLabel(node)}` : node);
        } else {
          setActiveNode(friendlyLabel(node) || node);
        }
      }
      return;
    }

    if (eventType === "thinking") {
      const node = payload?.node || "llm";
      const text = payload?.text || "";
      if (text) {
        const label = friendlyLabel(node) || node;
        setRawThoughts((prev) => `${prev}[${label}] ${text}\n\n`);
      }
      return;
    }

    if (eventType === "node_insight") {
      const field = payload?.field || "unknown";
      const label = payload?.label || field;
      const text = payload?.text || "";
      if (text) {
        setNodeInsights((prev) => ({
          ...prev,
          [field]: { label, text },
        }));
      }
      return;
    }

    if (eventType === "complete") {
      setAnalysisData(normalizeAnalyzePayload(payload));
      setError("");
      setIsStreaming(false);
      setActiveNode("");
      setCompletedSteps(TOTAL_STEPS);
      return;
    }

    if (eventType === "error") {
      setError(payload?.detail || "Backend stream failed.");
      setIsStreaming(false);
      setActiveNode("");
    }
  };

  const processChunk = (chunk, pending) => {
    const combined = (pending + chunk).replace(/\r\n/g, "\n");
    const events = combined.split("\n\n");
    const nextPending = events.pop() || "";

    for (const rawEvent of events) {
      const lines = rawEvent.split("\n");
      let eventType = "message";
      const dataLines = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      handleEvent(eventType, dataLines.join("\n"));
    }

    return nextPending;
  };

  const startStream = async (formData) => {
    stopStream();

    const controller = new AbortController();
    controllerRef.current = controller;

    setError("");
    setAnalysisData(null);
    setRawThoughts("");
    setNodeInsights({});
    setActiveNode("Starting analysis...");
    setIsStreaming(true);
    setCompletedSteps(0);
    completedNodesRef.current = new Set();

    try {
      const response = await fetch(
        `${backendBaseUrl}/episodic-intelligence/analyze/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(formData),
          signal: controller.signal,
        }
      );

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        pending = processChunk(decoder.decode(value, { stream: true }), pending);
      }

      if (pending.trim().length > 0) {
        processChunk("\n\n", pending);
      }
    } catch (streamError) {
      if (streamError?.name !== "AbortError") {
        setError(
          streamError?.message || "Could not connect to StoryFlow backend."
        );
      }
      setIsStreaming(false);
      setActiveNode("");
    } finally {
      controllerRef.current = null;
    }
  };

  return {
    backendBaseUrl,
    isStreaming,
    activeNode,
    rawThoughts,
    nodeInsights,
    analysisData,
    error,
    completedSteps,
    totalSteps: TOTAL_STEPS,
    startStream,
    stopStream,
  };
}
