import { ResearchState } from "../../schema/state";
import { webResearch } from "../../tools/webResearch";
import { fastModel, invokeWithRetry } from "../llm";
import { researchCache, CACHE_TTL } from "../cache";
import { HumanMessage } from "@langchain/core/messages";

export async function marketNode(state: ResearchState): Promise<Partial<ResearchState>> {
  try {
    const ticker = state.ticker;
    const tickerKey = ticker ? ticker.toUpperCase() : null;

    // Check in-memory cache
    if (tickerKey) {
      const cached = researchCache.get(tickerKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.marketData) {
        console.log(`[Cache Hit] Using cached marketData for ${tickerKey}`);
        return {
          marketData: cached.marketData,
        };
      }
    }

    const query = `${state.companyName} competitors market position 2026`;
    const searchResults = await webResearch(query, 5);
    const raw = { query, searchResults };

    if (searchResults.length === 0) {
      return {
        marketData: {
          raw,
          summary: "No market research data could be retrieved from web search.",
        },
        errors: [...state.errors, `marketNode: Web search returned 0 results for query: "${query}"`],
      };
    }

    const prompt = `You are a strategic market analyst. Synthesize the competitive positioning and industry dynamics for ${state.companyName} in 2026 based on these search results:

${JSON.stringify(searchResults)}

Provide a concise 4-6 sentence summary outlining:
- Major direct and indirect competitors.
- Market share and growth dynamics.
- The company's key competitive advantages (moats) or disadvantages.

Format your response as a single, coherent paragraph. Keep it factual and objective.`;

    const response = await invokeWithRetry(fastModel, [new HumanMessage(prompt)]);
    const summary = typeof response.content === "string" ? response.content.trim() : JSON.stringify(response.content);

    return {
      marketData: { raw, summary },
    };
  } catch (error: any) {
    return {
      errors: [...state.errors, `Error in marketNode: ${error.message || error}`],
    };
  }
}
