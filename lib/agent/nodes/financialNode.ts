import { ResearchState } from "../../schema/state";
import { getSecFilingsSummary, getKeyMetrics } from "../../tools/financialData";
import { fastModel, invokeWithRetry } from "../llm";
import { researchCache, CACHE_TTL } from "../cache";
import { HumanMessage } from "@langchain/core/messages";

export async function financialNode(state: ResearchState): Promise<Partial<ResearchState>> {
  try {
    const cik = state.cik;
    const ticker = state.ticker;

    if (!cik && !ticker) {
      return {
        financialData: {
          raw: null,
          summary: "No financial research could be completed because CIK and Ticker are missing.",
        },
        errors: [...state.errors, "financialNode: Both CIK and Ticker are missing. Cannot perform financial research."],
      };
    }

    // Check in-memory cache
    const tickerKey = ticker ? ticker.toUpperCase() : null;
    if (tickerKey) {
      const cached = researchCache.get(tickerKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.financialData) {
        console.log(`[Cache Hit] Using cached financialData for ${tickerKey}`);
        return {
          financialData: cached.financialData,
        };
      }
    }

    const [secFilings, keyMetrics] = await Promise.all([
      cik ? getSecFilingsSummary(cik) : Promise.resolve(null),
      ticker ? getKeyMetrics(ticker) : Promise.resolve(null),
    ]);

    const raw = { secFilings, keyMetrics };

    if (!secFilings && !keyMetrics) {
      return {
        financialData: {
          raw,
          summary: "No financial statements or key metrics could be retrieved.",
        },
        errors: [...state.errors, `financialNode: Failed to fetch both SEC filings and key metrics for ${state.companyName}.`],
      };
    }

    const prompt = `You are an expert investment analyst. Synthesize a concise 4-6 sentence financial health summary for ${state.companyName} based on the raw financial data:
    
Key Metrics: ${JSON.stringify(keyMetrics || "Unavailable")}
SEC Filings: ${JSON.stringify(secFilings || "Unavailable")}

Your summary MUST focus on:
- Revenue scale and profitability.
- Net income trend.
- Gross margin strength.
- Solvency/Leverage (debt-to-equity).
- 1-year stock performance.

Format your response as a single, coherent paragraph. Keep it factual, quantitative, and objective.`;

    const response = await invokeWithRetry(fastModel, [new HumanMessage(prompt)]);
    const summary = typeof response.content === "string" ? response.content.trim() : JSON.stringify(response.content);

    return {
      financialData: { raw, summary },
    };
  } catch (error: any) {
    return {
      errors: [...state.errors, `Error in financialNode: ${error.message || error}`],
    };
  }
}
