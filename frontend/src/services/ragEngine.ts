
import { Document } from "../types";
import { APP_CONFIG } from "../constants";

/**
 * Simple keyword-based ranking for client-side search.
 * In production, this would call a Vector DB / Backend API.
 */
export const searchKB = (query: string, documents: Document[]): Document[] => {
  if (!query.trim()) return [];

  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const scoredDocs = documents.map(doc => {
    let score = 0;
    const content = (doc.rawText || '').toLowerCase();
    const title = doc.fileName.toLowerCase();

    searchTerms.forEach(term => {
      // Title matches are more valuable
      if (title.includes(term)) score += 10;
      
      // Content matches
      const regex = new RegExp(term, 'gi');
      const matches = content.match(regex);
      if (matches) score += matches.length;
    });

    return { doc, score };
  });

  return scoredDocs
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, APP_CONFIG.MAX_SEARCH_RESULTS)
    .map(item => item.doc);
};

export const buildRAGContext = (results: Document[]): string => {
  return results
    .map(r => `[FONTE: ${r.fileName}]\n${(r.rawText || '').substring(0, 2000)}`)
    .join("\n\n---\n\n");
};
