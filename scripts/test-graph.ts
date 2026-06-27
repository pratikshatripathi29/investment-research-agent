import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("=== Graph Integration Runner ===");

  // Dynamic import to allow dotenv loading first
  const { runResearch, streamResearch } = await import("../lib/agent/graph");

  // 1. Test standard run research on Tesla
  console.log("\n=== Test 1: Successful Path (Tesla) ===");
  try {
    const start = Date.now();
    const result = await runResearch("Tesla");
    console.log(`Research completed in ${((Date.now() - start)/1000).toFixed(2)}s`);
    console.log("Resolved Ticker:", result.ticker);
    console.log("Resolved CIK:", result.cik);
    console.log("Synthesis Length:", result.synthesis?.length);
    console.log("Final Decision Verdict:", result.decision?.verdict);
    console.log("Final Decision Confidence:", result.decision?.confidence);
    console.log("Final Decision Sources:", result.decision?.sources);
    console.log("Final Decision Reasoning preview:\n", result.decision?.reasoning.substring(0, 300) + "...");
  } catch (e: any) {
    console.error("Test 1 failed:", e.message || e);
  }

  // 1B. Test caching on second run for Tesla
  console.log("\n=== Test 1B: Duplicate Path (Tesla Cache Hit) ===");
  try {
    const start = Date.now();
    const result = await runResearch("Tesla");
    console.log(`Research completed in ${((Date.now() - start)/1000).toFixed(2)}s`);
    console.log("Resolved Ticker:", result.ticker);
    console.log("Resolved CIK:", result.cik);
    console.log("Final Decision Verdict:", result.decision?.verdict);
    console.log("Final Decision Confidence:", result.decision?.confidence);
  } catch (e: any) {
    console.error("Test 1B failed:", e.message || e);
  }

  // 2. Test fail path on nonsense query
  console.log("\n=== Test 2: Fail Path (Nonsense Input) ===");
  try {
    const result = await runResearch("asdfqwer123nonsense");
    console.log("Final Decision Verdict:", result.decision?.verdict);
    console.log("Final Decision Bear Case:", result.decision?.bearCase);
    console.log("Final Decision Reasoning:\n", result.decision?.reasoning);
  } catch (e: any) {
    console.error("Test 2 failed:", e.message || e);
  }
}

main().catch(console.error);
