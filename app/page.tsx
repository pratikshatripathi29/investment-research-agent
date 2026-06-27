"use client";

import React, { useState } from "react";
import { ReportView } from "../components/ReportView";
import { Decision } from "../lib/schema/state";

interface StepState {
  id: string;
  label: string;
  status: "idle" | "running" | "done";
  message: string;
}

const INITIAL_STEPS: StepState[] = [
  { id: "resolver", label: "Company Resolution", status: "idle", message: "Pending company name resolution..." },
  { id: "financial", label: "Financial Analysis", status: "idle", message: "Pending CIK resolution..." },
  { id: "market", label: "Market Research", status: "idle", message: "Pending CIK resolution..." },
  { id: "news", label: "News & Sentiment", status: "idle", message: "Pending CIK resolution..." },
  { id: "risk", label: "Risk Assessment", status: "idle", message: "Pending CIK resolution..." },
  { id: "aggregator", label: "Synthesis Aggregation", status: "idle", message: "Waiting for parallel research to complete..." },
  { id: "decision_node", label: "Verdict Formulation", status: "idle", message: "Waiting for synthesis..." },
  { id: "critic", label: "Critic Challenge", status: "idle", message: "Waiting for verdict..." },
];

export default function Home() {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [synthesis, setSynthesis] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setLoading(true);
    setError(null);
    setSynthesis("");
    setDecision(null);
    setSteps(INITIAL_STEPS.map(step => ({ ...step, status: "idle" })));

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream reader not supported.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          // SSE format: event: name\ndata: json
          const lines = part.split("\n");
          let event = "";
          let dataText = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              event = line.substring(6).trim();
            } else if (line.startsWith("data:")) {
              dataText = line.substring(5).trim();
            }
          }

          console.log("[Client SSE] Event parsed:", event, "Data length:", dataText.length);

          if (event === "progress" && dataText) {
            const progress = JSON.parse(dataText);
            const { node, status, message } = progress;

            setSteps(prev =>
              prev.map(step => {
                if (step.id === node) {
                  return { ...step, status, message };
                }
                return step;
              })
            );
          } else if (event === "complete" && dataText) {
            const finalData = JSON.parse(dataText);
            console.log("[Client SSE] Complete payload received:", finalData);
            
            // Check if it failed company CIK/ticker resolution (failNode outcome)
            if (finalData.decision && finalData.decision.confidence === 0 && finalData.decision.verdict === "watch") {
              setError("COMPANY NOT FOUND: The research agent failed to match the query to a valid SEC CIK or ticker. Please verify the company name spelling and try again.");
              setLoading(false);
              return;
            }

            setSynthesis(finalData.synthesis);
            setDecision(finalData.decision);
            setLoading(false);
          } else if (event === "error" && dataText) {
            const errPayload = JSON.parse(dataText);
            throw new Error(errPayload.message || "An error occurred during streaming.");
          }
        }
      }
    } catch (err: any) {
      console.error("Error during submit handler:", err);
      const errMsg = err.message || "";
      
      // Categorize errors to show explicit frontend error messages
      if (
        errMsg.includes("Failed to resolve CIK/ticker") || 
        errMsg.includes("Could not resolve") || 
        errMsg.includes("lookup failure") ||
        errMsg.includes("companyName is required")
      ) {
        setError("COMPANY NOT FOUND: We couldn't resolve the entered name to a valid SEC-registered corporation CIK. Please refine your query (e.g. use standard names like Apple or Microsoft).");
      } else if (
        errMsg.includes("429") || 
        errMsg.includes("rate_limit") || 
        errMsg.includes("Rate limit reached") ||
        errMsg.includes("rate limit")
      ) {
        setError("UPSTREAM API RATE LIMIT HIT: The Groq LLM API or financial data providers are experiencing temporary rate limits. Please wait a few seconds and try again.");
      } else {
        setError(`GENERIC SERVER ERROR: A server-side processing error occurred while executing the research agent graph (${errMsg || "no detail provided"}). Please try again or inspect server logs.`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-mono antialiased selection:bg-zinc-800 selection:text-white">
      {/* Top Banner / Header */}
      <header className="border-b border-zinc-900 px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-bold text-lg tracking-tight text-white">ARGUS INVESTMENT RESEARCH</span>
          </div>
          <span className="text-xs text-zinc-500 font-medium">VERSION 1.0 (BETA)</span>
        </div>
      </header>

      {/* Main Panel */}
      <main className="max-w-5xl mx-auto px-8 py-12">
        {/* Search Panel */}
        <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg mb-8">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              placeholder="ENTER PUBLIC COMPANY NAME OR TICKER (e.g. Apple, TSLA, NVDA)"
              className="flex-1 bg-black border border-zinc-800 rounded px-4 py-3 text-sm focus:outline-none focus:border-zinc-700 text-white placeholder-zinc-600 tracking-wide font-mono"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !companyName.trim()}
              className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs tracking-wider uppercase px-6 py-3 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? "RESEARCHING..." : "RUN ANALYSIS"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-rose-950/50 border border-rose-800 rounded text-rose-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Execution Log Timeline */}
        {(loading || (steps.some(s => s.status !== "idle") && !error)) && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8 animate-fade-in">
            <h2 className="text-xs font-bold tracking-wider text-zinc-400 uppercase mb-6 flex items-center justify-between">
              <span>AGENTS EXECUTION PIPELINE</span>
              {loading && <span className="animate-pulse text-emerald-400">STREAMING ACTIVE</span>}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {steps.map(step => (
                <div
                  key={step.id}
                  className={`p-4 rounded border transition-all duration-200 ${
                    step.status === "running"
                      ? "bg-zinc-950 border-zinc-700 text-white"
                      : step.status === "done"
                      ? "bg-zinc-900 border-zinc-800/80 text-zinc-300"
                      : "bg-zinc-900/40 border-zinc-900 text-zinc-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs tracking-wide uppercase">{step.label}</span>
                    {step.status === "running" ? (
                      <span className="text-[10px] bg-zinc-800 text-zinc-200 border border-zinc-700 px-1.5 py-0.5 rounded animate-pulse">
                        RUNNING
                      </span>
                    ) : step.status === "done" ? (
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded">
                        ✓ COMPLETE
                      </span>
                    ) : (
                      <span className="text-[10px] bg-zinc-950 text-zinc-700 border border-zinc-900 px-1.5 py-0.5 rounded">
                        QUEUE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] truncate leading-relaxed">
                    {step.message}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Final Report Dashboard */}
        {decision && !error && (
          <section className="animate-fade-in">
            <ReportView decision={decision} synthesis={synthesis} />
          </section>
        )}
      </main>
    </div>
  );
}
