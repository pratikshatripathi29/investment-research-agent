export interface CachedResearch {
  timestamp: number;
  financialData: any;
  marketData: any;
  newsData: any;
  riskData: any;
}

// In-memory cache Map keyed by UPPERCASE ticker
export const researchCache = new Map<string, CachedResearch>();

// Cache expiration: 1 hour (in milliseconds)
export const CACHE_TTL = 60 * 60 * 1000;
