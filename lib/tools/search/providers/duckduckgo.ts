import { SearchResults } from '@/lib/types'

import { BaseSearchProvider } from './base'

/**
 * DuckDuckGo-based search provider using the free DuckDuckGo HTML endpoint.
 * No API key required.
 */
export class DuckDuckGoSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    _searchDepth: 'basic' | 'advanced' = 'basic',
    _includeDomains: string[] = [],
    _excludeDomains: string[] = []
  ): Promise<SearchResults> {
    // Use DuckDuckGo's HTML search endpoint
    const encodedQuery = encodeURIComponent(query)
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(
          `DuckDuckGo search error: ${response.status} ${response.statusText}`
        )
      }

      const html = await response.text()
      const results = this.parseResults(html, maxResults)

      return {
        results,
        query,
        images: [],
        number_of_results: results.length
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('DuckDuckGo search timed out after 15 seconds')
      }
      throw error
    }
  }

  private parseResults(
    html: string,
    maxResults: number
  ): Array<{ title: string; url: string; content: string }> {
    const results: Array<{ title: string; url: string; content: string }> = []

    // Parse result blocks from DuckDuckGo HTML response
    // Each result is in a div with class "result"
    const resultBlocks = html.split(/class="result\s/)

    for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
      const block = resultBlocks[i]

      // Extract URL from the result link
      const urlMatch = block.match(
        /class="result__a"[^>]*href="([^"]*)"/ 
      )
      // Also try uddg parameter which DuckDuckGo uses for redirects
      const uddgMatch = block.match(/uddg=([^&"]+)/)
      
      let resultUrl = ''
      if (uddgMatch) {
        try {
          resultUrl = decodeURIComponent(uddgMatch[1])
        } catch {
          resultUrl = uddgMatch[1]
        }
      } else if (urlMatch) {
        resultUrl = urlMatch[1]
      }

      // Skip if no valid URL
      if (
        !resultUrl ||
        resultUrl.startsWith('/') ||
        resultUrl.includes('duckduckgo.com')
      ) {
        continue
      }

      // Extract title
      const titleMatch = block.match(
        /class="result__a"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/
      )
      const title = titleMatch
        ? titleMatch[1].replace(/<[^>]*>/g, '').trim()
        : ''

      // Extract snippet/description
      const snippetMatch = block.match(
        /class="result__snippet"[^>]*>([\s\S]*?)(?:<\/a>|<\/td>)/
      )
      const content = snippetMatch
        ? snippetMatch[1]
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim()
        : ''

      if (title && resultUrl) {
        results.push({ title, url: resultUrl, content })
      }
    }

    return results
  }
}
