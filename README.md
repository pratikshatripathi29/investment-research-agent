# Argus Investment Research Agent
https://investment-research-agent-chi.vercel.app/
Argus is an automated AI-driven investment research analyst built with **Next.js**, **LangGraph.js**, and **Groq LLMs**. It takes a company name or ticker, resolves it to its official SEC CIK, executes four parallel research streams, aggregates the findings into an investment brief, applies a rigorous structured evaluation rubric, and runs a devil's-advocate reviewer pass before outputting a finalized investment verdict.

The entire node-by-node execution pipeline is streamed to a custom terminal-inspired dashboard in real time using Server-Sent Events (SSE).

---

## Features

- **Company Normalization & Resolution**: Resolves fuzzy company names to official SEC tickers/CIK indexes with a 24-hour memory cache.
- **Parallel Agent Research**: Executes four parallel streams concurrently (SEC filings & FMP key metrics, market positioning, news sentiment, regulatory risk).
- **Executive Synthesis**: Aggregates raw findings into a cohesive, multi-paragraph research brief.
- **Rubric-Based Evaluation**: Rates company prospects using a skeptical 6-dimension rubric.
- **Skeptical Critic Node**: Performs a devil's-advocate review of the thesis, adjusting confidence or revising the final recommendation.
- **Automatic Backoff & Rate-Limit Retry**: Intercepts `429 Too Many Requests` API limits, sleeps for the specified time, and automatically resumes.
- **Simple 1-Hour Cache**: Stores researched company financial, news, and risk profiles in an in-memory cache for 1 hour to prevent redundant API bills.
- **SSE streaming**: Streams live update nodes (`running` and `done` states) and the final report JSON down to the client.

---

## How to Run Locally

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (version 18+ recommended) installed.

### 1. Installation

Clone the repository and install the dependencies:

```bash
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory by copying the example:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the required API keys (details on obtaining them are below).

### 3. Running the Development Server

Start the local server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the dashboard.

### 4. Running Verification Test Scripts

You can also execute the backend modules and graph steps directly from the command line:

- **Graph integration check**: `npx tsx scripts/test-graph.ts`
- **Node-by-node pipeline check**: `npx tsx scripts/test-nodes.ts`
- **Financial metrics fetcher check**: `npx tsx scripts/test-financials.ts`

---

## How to Obtain Free API Keys

### 1. Groq API Key (`GROQ_API_KEY`)
Groq provides high-speed access to open models like Llama 3.
- **Step 1**: Visit the [Groq Console](https://console.groq.com/) and register a free account.
- **Step 2**: Navigate to the **API Keys** section in the sidebar.
- **Step 3**: Click **Create API Key**, name it, and copy the key into `GROQ_API_KEY`.

### 2. Tavily Search API Key (`TAVILY_API_KEY`)
Tavily is an AI-optimized search engine that returns clean, synthesized web results.
- **Step 1**: Go to [Tavily AI](https://tavily.com/) and sign up for a developer account.
- **Step 2**: Copy your API key from the main developer console dashboard.
- **Step 3**: Paste the key into `TAVILY_API_KEY` (Free tier provides 1,000 searches per month).

### 3. Financial Modeling Prep API Key (`FMP_API_KEY`)
Financial Modeling Prep provides access to corporate financial reports and ratios.
- **Step 1**: Visit the [Financial Modeling Prep Developer Portal](https://site.financialmodelingprep.com/developer/docs) and register.
- **Step 2**: You will be assigned a free API key on your dashboard.
- **Step 3**: Copy the key into `FMP_API_KEY` (Free plan supports access to standard income statements and ratio metrics).

### 4. SEC User Agent (`SEC_USER_AGENT`)
The SEC EDGAR system requires all API requests to declare a User-Agent header identifying the entity making the query for rate-limiting compliance.
- **Required Format**: `CompanyName contact@email.com` (e.g., `ArgusResearch contact@argus.com`).
- **How to set**: Add any standard identifier name and email to `SEC_USER_AGENT` (no registration or sign-up key is required).
