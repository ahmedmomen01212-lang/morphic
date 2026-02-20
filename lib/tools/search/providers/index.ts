import { SearchProvider } from './base'
import { BraveSearchProvider } from './brave'
import { DuckDuckGoSearchProvider } from './duckduckgo'
import { ExaSearchProvider } from './exa'
import { FirecrawlSearchProvider } from './firecrawl'
import { SearXNGSearchProvider } from './searxng'
import { TavilySearchProvider } from './tavily'

export type SearchProviderType =
  | 'tavily'
  | 'exa'
  | 'searxng'
  | 'firecrawl'
  | 'brave'
  | 'duckduckgo'

/**
 * Determine the default search provider based on available API keys.
 * Falls back to DuckDuckGo (no API key needed) when nothing else is configured.
 */
function getDefaultProvider(): SearchProviderType {
  if (process.env.TAVILY_API_KEY) return 'tavily'
  if (process.env.EXA_API_KEY) return 'exa'
  if (process.env.BRAVE_API_KEY) return 'brave'
  if (process.env.FIRECRAWL_API_KEY) return 'firecrawl'
  if (process.env.SEARXNG_API_URL) return 'searxng'
  return 'duckduckgo'
}

export const DEFAULT_PROVIDER: SearchProviderType = getDefaultProvider()

export function createSearchProvider(
  type?: SearchProviderType
): SearchProvider {
  const providerType =
    type || (process.env.SEARCH_API as SearchProviderType) || DEFAULT_PROVIDER

  switch (providerType) {
    case 'tavily':
      return new TavilySearchProvider()
    case 'exa':
      return new ExaSearchProvider()
    case 'searxng':
      return new SearXNGSearchProvider()
    case 'brave':
      return new BraveSearchProvider()
    case 'firecrawl':
      return new FirecrawlSearchProvider()
    case 'duckduckgo':
      return new DuckDuckGoSearchProvider()
    default:
      // Default to DuckDuckGo if no API keys are configured
      return new DuckDuckGoSearchProvider()
  }
}

export { BraveSearchProvider } from './brave'
export { DuckDuckGoSearchProvider } from './duckduckgo'
export type { ExaSearchProvider } from './exa'
export type { FirecrawlSearchProvider } from './firecrawl'
export { SearXNGSearchProvider } from './searxng'
export { TavilySearchProvider } from './tavily'
export type { SearchProvider }
