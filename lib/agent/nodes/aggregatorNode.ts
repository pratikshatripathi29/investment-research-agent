import { ResearchState } from "../../schema/state";
import { fastModel, invokeWithRetry } from "../llm";
import { researchCache } from "../cache";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Aggregator node that synthesizes the summaries from the parallel research nodes
 * (financial, market, news, risk) into a unified, well-structured research brief.
 * Also writes the collected research data to the in-memory cache for subsequent runs.
 */
export async function aggregatorNode(state: ResearchState): Promise<Partial<ResearchState>> {
  try {
    const financialSummary = state.financialData?.summary || "No financial summary available.";
    const marketSummary = state.marketData?.summary || "No market summary available.";
    const newsSummary = state.newsData?.summary || "No recent news summary available.";
    const riskSummary = state.riskData?.summary || "No risk assessment available.";

    // Write to in-memory cache if we have a valid resolved ticker
    if (state.ticker) {
      const tickerKey = state.ticker.toUpperCase();
      researchCache.set(tickerKey, {
        timestamp: Date.now(),
        financialData: state.financialData,
        marketData: state.marketData,
        newsData: state.newsData,
        riskData: state.riskData,
      });
      console.log(`[Cache Write] Saved research data for ${tickerKey} to cache.`);
    }

    const prompt = `You are a senior investment analyst. Combine the following research summaries for ${state.companyName} into a single, cohesive, well-structured investment research brief.
    
---
1. Financial Health Summary:
${financialSummary}

---
2. Market Position & Competitive Dynamics:
${marketSummary}

---
3. Recent News & Developments:
${newsSummary}

---
4. Key Risks & Controversies:
${riskSummary}
---

Your research brief should be structured into 3-4 cohesive paragraphs. Write in a formal, professional, and objective investment tone. Highlight the key intersections between these areas (e.g., how financial strength mitigates regulatory risks, or how market competition impacts future growth).`;

    const response = await invokeWithRetry(fastModel, [new HumanMessage(prompt)]);
    const synthesis = typeof response.content === "string" ? response.content.trim() : JSON.stringify(response.content);

    return {
      synthesis,
    };
  } catch (error: any) {
    return {
      errors: [...state.errors, `Error in aggregatorNode: ${error.message || error}`],
    };
  }
}
