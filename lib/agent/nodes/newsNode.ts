import { ResearchState } from "../../schema/state";
import { webResearch } from "../../tools/webResearch";
import { fastModel, invokeWithRetry } from "../llm";
import { researchCache, CACHE_TTL } from "../cache";
import { HumanMessage } from "@langchain/core/messages";

export async function newsNode(state: ResearchState): Promise<Partial<ResearchState>> {
  try {
    const ticker = state.ticker;
    const tickerKey = ticker ? ticker.toUpperCase() : null;

    // Check in-memory cache
    if (tickerKey) {
      const cached = researchCache.get(tickerKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.newsData) {
        console.log(`[Cache Hit] Using cached newsData for ${tickerKey}`);
        return {
          newsData: cached.newsData,
        };
      }
    }

    const query = `${state.companyName} recent news 2026`;
    const searchResults = await webResearch(query, 5);
    const raw = { query, searchResults };

    if (searchResults.length === 0) {
      return {
        newsData: {
          raw,
          summary: "No news research data could be retrieved from web search.",
        },
        errors: [...state.errors, `newsNode: Web search returned 0 results for query: "${query}"`],
      };
    }

    const prompt = `You are a financial news editor. Synthesize recent news events and overall market sentiment for ${state.companyName} in 2026 based on these search results:

${JSON.stringify(searchResults)}

Provide a concise 4-6 sentence summary outlining:
- Key recent events, product launches, or earnings reports.
- Major shifts in executive leadership or corporate strategy if any.
- Current public and investor sentiment.

Format your response as a single, coherent paragraph. Keep it factual and objective.`;

    const response = await invokeWithRetry(fastModel, [new HumanMessage(prompt)]);
    const summary = typeof response.content === "string" ? response.content.trim() : JSON.stringify(response.content);

    return {
      newsData: { raw, summary },
    };
  } catch (error: any) {
    return {
      errors: [...state.errors, `Error in newsNode: ${error.message || error}`],
    };
  }
}
