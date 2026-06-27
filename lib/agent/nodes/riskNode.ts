import { ResearchState } from "../../schema/state";
import { webResearch } from "../../tools/webResearch";
import { fastModel, invokeWithRetry } from "../llm";
import { researchCache, CACHE_TTL } from "../cache";
import { HumanMessage } from "@langchain/core/messages";

export async function riskNode(state: ResearchState): Promise<Partial<ResearchState>> {
  try {
    const ticker = state.ticker;
    const tickerKey = ticker ? ticker.toUpperCase() : null;

    // Check in-memory cache
    if (tickerKey) {
      const cached = researchCache.get(tickerKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.riskData) {
        console.log(`[Cache Hit] Using cached riskData for ${tickerKey}`);
        return {
          riskData: cached.riskData,
        };
      }
    }

    const query = `${state.companyName} lawsuit OR investigation OR regulatory risk OR controversy`;
    const searchResults = await webResearch(query, 5);
    const raw = { query, searchResults };

    if (searchResults.length === 0) {
      return {
        riskData: {
          raw,
          summary: "No risk research data could be retrieved from web search.",
        },
        errors: [...state.errors, `riskNode: Web search returned 0 results for query: "${query}"`],
      };
    }

    const prompt = `You are a corporate risk assessment specialist. Synthesize the key risks, lawsuits, regulatory investigations, and controversies facing ${state.companyName} in 2026 based on these search results:

${JSON.stringify(searchResults)}

Provide a concise 4-6 sentence summary outlining:
- Ongoing litigations, class actions, or regulatory reviews.
- Operational or supply chain vulnerabilities.
- Market-wide or geopolitical risks impacting the business model.

Format your response as a single, coherent paragraph. Keep it factual and objective.`;

    const response = await invokeWithRetry(fastModel, [new HumanMessage(prompt)]);
    const summary = typeof response.content === "string" ? response.content.trim() : JSON.stringify(response.content);

    return {
      riskData: { raw, summary },
    };
  } catch (error: any) {
    return {
      errors: [...state.errors, `Error in riskNode: ${error.message || error}`],
    };
  }
}
