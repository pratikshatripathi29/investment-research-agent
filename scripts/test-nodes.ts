import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("=== Node Verification Runner ===");

  // Use dynamic imports to ensure dotenv is fully loaded first
  const { resolverNode } = await import("../lib/agent/nodes/resolverNode");
  const { financialNode } = await import("../lib/agent/nodes/financialNode");
  const { marketNode } = await import("../lib/agent/nodes/marketNode");
  const { newsNode } = await import("../lib/agent/nodes/newsNode");
  const { riskNode } = await import("../lib/agent/nodes/riskNode");

  // Initial dummy state
  let state = {
    companyName: "Tesla",
    ticker: null as string | null,
    cik: null as string | null,
    financialData: null as any,
    marketData: null as any,
    newsData: null as any,
    riskData: null as any,
    synthesis: null as string | null,
    decision: null as any,
    errors: [] as string[],
  };

  console.log("\n1. Running resolverNode against:", state.companyName);
  const resolverUpdate = await resolverNode(state as any);
  console.log("Resolver output:", JSON.stringify(resolverUpdate, null, 2));
  state = { ...state, ...resolverUpdate } as any;

  if (state.errors.length > 0) {
    console.error("Errors found during resolution:", state.errors);
    return;
  }

  console.log("\n2. Running financialNode with ticker:", state.ticker, "and CIK:", state.cik);
  const financialUpdate = await financialNode(state as any);
  console.log("Financial summary:", financialUpdate.financialData?.summary);
  console.log("Financial raw metrics present:", !!(financialUpdate.financialData?.raw as any)?.keyMetrics);
  state = { ...state, ...financialUpdate } as any;

  console.log("\n3. Running marketNode...");
  const marketUpdate = await marketNode(state as any);
  console.log("Market summary:", marketUpdate.marketData?.summary);
  state = { ...state, ...marketUpdate } as any;

  console.log("\n4. Running newsNode...");
  const newsUpdate = await newsNode(state as any);
  console.log("News summary:", newsUpdate.newsData?.summary);
  state = { ...state, ...newsUpdate } as any;

  console.log("\n5. Running riskNode...");
  const riskUpdate = await riskNode(state as any);
  console.log("Risk summary:", riskUpdate.riskData?.summary);
  state = { ...state, ...riskUpdate } as any;

  const { aggregatorNode } = await import("../lib/agent/nodes/aggregatorNode");
  console.log("\n6. Running aggregatorNode...");
  const aggregatorUpdate = await aggregatorNode(state as any);
  console.log("Aggregator synthesis:\n", aggregatorUpdate.synthesis);
  state = { ...state, ...aggregatorUpdate } as any;

  const { decisionNode } = await import("../lib/agent/nodes/decisionNode");
  console.log("\n7. Running decisionNode...");
  const decisionUpdate = await decisionNode(state as any);
  console.log("Decision output:\n", JSON.stringify(decisionUpdate.decision, null, 2));
  state = { ...state, ...decisionUpdate } as any;

  const { criticNode } = await import("../lib/agent/nodes/criticNode");
  console.log("\n8. Running criticNode...");
  const criticUpdate = await criticNode(state as any);
  console.log("Critic output decision:\n", JSON.stringify(criticUpdate.decision, null, 2));
  state = { ...state, ...criticUpdate } as any;

  console.log("\n=== Complete Node Run Verification ===");
  console.log("Total errors captured:", state.errors.length);
  if (state.errors.length > 0) {
    console.log("Captured errors list:", JSON.stringify(state.errors, null, 2));
  }
}

main().catch(console.error);
