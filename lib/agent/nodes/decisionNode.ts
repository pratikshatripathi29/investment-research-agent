import { ResearchState, decisionSchema } from "../../schema/state";
import { reasoningModel, invokeWithRetry } from "../llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * Decision node that reviews the aggregated research synthesis (synthesis)
 * and individual summaries, applies a strict analytical rubric, and outputs
 * a structured decision validated against the decisionSchema.
 */
export async function decisionNode(state: ResearchState): Promise<Partial<ResearchState>> {
  try {
    const synthesis = state.synthesis || "No research brief available.";
    const financialSummary = state.financialData?.summary || "N/A";
    const marketSummary = state.marketData?.summary || "N/A";
    const newsSummary = state.newsData?.summary || "N/A";
    const riskSummary = state.riskData?.summary || "N/A";

    // Extract all verifiable raw URLs collected in the state
    const verifiableUrls: string[] = [];
    
    interface RawFinancialData {
      secFilings?: Array<{ primaryDocumentUrl?: string }> | null;
      keyMetrics?: any;
    }
    interface SearchResultData {
      searchResults?: Array<{ url?: string }> | null;
    }

    const rawFin = state.financialData?.raw as RawFinancialData | undefined;
    if (rawFin?.secFilings) {
      const filings = rawFin.secFilings;
      if (Array.isArray(filings)) {
        filings.forEach((filing: any) => {
          if (filing && filing.primaryDocumentUrl) {
            verifiableUrls.push(filing.primaryDocumentUrl);
          }
        });
      }
    }

    const rawMarket = state.marketData?.raw as SearchResultData | undefined;
    const rawNews = state.newsData?.raw as SearchResultData | undefined;
    const rawRisk = state.riskData?.raw as SearchResultData | undefined;

    const rawSearchSources = [
      rawMarket?.searchResults,
      rawNews?.searchResults,
      rawRisk?.searchResults,
    ];

    rawSearchSources.forEach((results) => {
      if (Array.isArray(results)) {
        results.forEach((item: any) => {
          if (item && item.url) {
            verifiableUrls.push(item.url);
          }
        });
      }
    });

    const uniqueVerifiableUrls = Array.from(new Set(verifiableUrls));

    const systemPrompt = `You are a rigorous, highly skeptical lead investment analyst. Your job is to evaluate the research synthesis and summaries of a company and make a final investment decision: "invest", "pass", or "watch".
    
Evaluate the company across these 6 key dimensions:
1. Financial health (profitability, margins, growth, debt levels, cash flows).
2. Growth trajectory (revenue trends, market expansion).
3. Competitive moat (branding, vertical integration, pricing power, tech moats).
4. Valuation (stock performance vs. fundamentals; EXPLICITLY flag if data is insufficient).
5. Management quality (leadership strength, corporate strategy, execution).
6. Risk factors (regulatory headwinds, litigation, concentration risk, macroeconomic risks).

Investment Verdict Rubric:
- "invest": Recommending TO invest (buy the stock). Requires strong financials, clear moat, manageable leverage, and acceptable risk profile.
- "pass": Recommending AGAINST investing (decline to invest / do NOT buy). Recomended when there is high debt-to-equity, decaying gross margins, severe legal/regulatory threats, or lack of competitive moat.
- "watch": mixed signals or insufficient/mixed data to decide either way (keep on watchlist). Prefer "watch" over forcing a binary choice when evidence is mixed or valuation data is lacking.

CRITICAL SEMANTIC RULES:
- "pass" means decline to invest (a negative recommendation). Do NOT use "pass" to mean "passes the test" or as a positive endorsement. If your reasoning text argues the company is a good/attractive investment opportunity, the verdict MUST be "invest", NOT "pass".
- Make sure the reasoning text's conclusion direction always matches the chosen verdict. If the reasoning leans positive, the verdict should be 'invest'. If the reasoning leans negative, the verdict should be 'pass'. If mixed/neutral, it should be 'watch'.

CRITICAL INSTRUCTIONS:
- You must output structured data that conforms strictly to the schema.
- All values in the JSON (especially in 'sources', 'reasoning', 'bullCase', 'bearCase', 'risks') MUST be plain text.
- Do NOT use markdown links, parentheses containing URLs, or formatting like "[Link text](url)" inside the JSON fields or at the end of the JSON object.
- The 'sources' array MUST only contain actual URL strings selected from the provided "AVAILABLE VERIFIABLE SOURCE URLS" list.
- Do NOT include generic names (like "Financial Summary", "Market Positioning Summary", "Tesla Investment Research Brief") as sources.
- Do NOT invent, guess, or copy example URLs that are not in the provided list. If no URLs are in the list, return an empty array for 'sources'.`;

    const humanPrompt = `Evaluate the company "${state.companyName}" (${state.ticker || "N/A"}) using the following investment briefs:

---
INVESTMENT BRIEF SYNTHESIS:
${synthesis}

---
FINANCIAL SUMMARY:
${financialSummary}

---
MARKET POSITIONING SUMMARY:
${marketSummary}

---
RECENT NEWS SUMMARY:
${newsSummary}

---
RISK AND CONTROVERSY SUMMARY:
${riskSummary}

---
AVAILABLE VERIFIABLE SOURCE URLS:
${uniqueVerifiableUrls.length > 0 ? uniqueVerifiableUrls.map(url => `- ${url}`).join("\n") : "No verifiable source URLs available."}
---

Produce the final decision object. Select elements for the 'sources' array ONLY from the "AVAILABLE VERIFIABLE SOURCE URLS" list above. Do not include any other URLs or names.`;

    const structuredLlm = reasoningModel.withStructuredOutput(decisionSchema);
    
    // Invoke LLM via the rate-limit retry wrapper
    const decision = await invokeWithRetry(structuredLlm, [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    return {
      decision,
    };
  } catch (error: any) {
    return {
      errors: [...state.errors, `Error in decisionNode: ${error.message || error}`],
    };
  }
}
