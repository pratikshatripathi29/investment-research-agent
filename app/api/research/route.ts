import { NextRequest } from "next/server";
import { streamResearch } from "../../../lib/agent/graph";

export const dynamic = "force-dynamic";

/**
 * POST handler to trigger company research and stream graph node execution state
 * via Server-Sent Events (SSE).
 */
export async function POST(req: NextRequest) {
  try {
    const { companyName } = await req.json();
    if (!companyName || typeof companyName !== "string") {
      return new Response(JSON.stringify({ error: "companyName is required and must be a string." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Utility helper to push formatted SSE packets
        const sendEvent = (event: string, data: any) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            console.warn("ReadableStream controller enqueue failed (client disconnected):", e);
          }
        };

        try {
          // 1. Initial State: Starting resolver
          sendEvent("progress", {
            node: "resolver",
            status: "running",
            message: `Resolving CIK and ticker index for "${companyName}"...`
          });

          // 2. Fetch the graph execution stream
          const researchStream = await streamResearch(companyName);
          let finalState: any = {};

          for await (const chunk of researchStream) {
            const keys = Object.keys(chunk) as Array<keyof typeof chunk>;
            if (keys.length === 0) continue;
            const nodeName = keys[0];
            const nodeOutput = chunk[nodeName];

            // Accumulate updates to capture final synthesis and decision
            if (nodeOutput) {
              finalState = { ...finalState, ...nodeOutput };
            }

            // Route execution progress status messages
            if (nodeName === "resolver" && chunk.resolver) {
              const ticker = chunk.resolver.ticker;
              const cik = chunk.resolver.cik;

              if (ticker && cik) {
                sendEvent("progress", {
                  node: "resolver",
                  status: "done",
                  message: `Successfully resolved "${companyName}" to ticker ${ticker} (CIK: ${cik}).`
                });

                // Signal parallel fan-out running states
                sendEvent("progress", { node: "financial", status: "running", message: "Fetching SEC filings and key metrics..." });
                sendEvent("progress", { node: "market", status: "running", message: "Analysing competitive positioning and industry dynamics..." });
                sendEvent("progress", { node: "news", status: "running", message: "Gathering recent news events and investor sentiment..." });
                sendEvent("progress", { node: "risk", status: "running", message: "Scanning for litigation, regulations, and risk factors..." });
              } else {
                sendEvent("progress", {
                  node: "resolver",
                  status: "done",
                  message: `Could not resolve "${companyName}" to a valid SEC ticker/CIK.`
                });
                sendEvent("progress", { node: "fail", status: "running", message: "Routing to failure abort sequence..." });
              }
            } else if (nodeName === "financial") {
              sendEvent("progress", { node: "financial", status: "done", message: "Completed financial health assessment summary." });
            } else if (nodeName === "market") {
              sendEvent("progress", { node: "market", status: "done", message: "Completed market moat and competitors analysis." });
            } else if (nodeName === "news") {
              sendEvent("progress", { node: "news", status: "done", message: "Completed recent news and developments analysis." });
            } else if (nodeName === "risk") {
              sendEvent("progress", { node: "risk", status: "done", message: "Completed risk and litigations scan." });
            } else if (nodeName === "aggregator") {
              sendEvent("progress", { node: "aggregator", status: "done", message: "Successfully aggregated parallel summaries into investment research brief." });
              sendEvent("progress", { node: "decision_node", status: "running", message: "Evaluating company fundamentals against investment rubric..." });
            } else if (nodeName === "decision_node") {
              sendEvent("progress", { node: "decision_node", status: "done", message: "Formulated preliminary investment decision." });
              sendEvent("progress", { node: "critic", status: "running", message: "Executing devil's advocate reviewer critique..." });
            } else if (nodeName === "critic") {
              sendEvent("progress", { node: "critic", status: "done", message: "Finalized critic review and verdict adjustment." });
            } else if (nodeName === "fail") {
              sendEvent("progress", { node: "fail", status: "done", message: "Aborted research due to lookup failure." });
            }
          }

          // 3. Complete State: send final decision and synthesis data
          sendEvent("complete", {
            synthesis: finalState.synthesis || "",
            decision: finalState.decision || null,
          });

          controller.close();
        } catch (error: any) {
          console.error("Error during SSE stream execution:", error);
          sendEvent("error", {
            message: error.message || "An unexpected error occurred during agent research graph execution."
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Error parsing request body in research route:", error);
    return new Response(JSON.stringify({ error: "Failed to process request: " + (error.message || error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
