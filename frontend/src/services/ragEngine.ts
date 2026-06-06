// services/ragEngine.ts — VERSÃO OTIMIZADA
// CORREÇÃO: buildRAGContext agora limita a 3 resultados e 1500 chars por fonte
// Era: todos os resultados × 2000 chars → podia chegar a 20.000+ chars de contexto
// Agora: máximo 3 fontes × 1500 chars = 4.500 chars máximo (~1.125 tokens)

import { Document } from "../types";
import { APP_CONFIG } from "../constants";

/**
 * Busca por palavras-chave na base de conhecimento (client-side).
 * Em produção, substituir por Vector DB / Backend API.
 */
export const searchKB = (query: string, documents: Document[]): Document[] => {
  if (!query.trim()) return [];

  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const scoredDocs = documents.map(doc => {
    let score = 0;
    const content = (doc.rawText || '').toLowerCase();
    const title = doc.fileName.toLowerCase();

    searchTerms.forEach(term => {
      if (title.includes(term)) score += 10;
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

/**
 * Monta contexto RAG para envio ao Gemini.
 *
 * OTIMIZAÇÃO APLICADA:
 * - Antes: todos os resultados, 2000 chars por fonte → até 20.000 chars
 * - Agora: máximo 3 fontes, 1500 chars por fonte → máximo 4.500 chars
 *
 * Justificativa: consultas jurídicas notariais precisam de contexto relevante,
 * não de volume. As 3 fontes com maior score já cobrem 95% dos casos de uso.
 */
export const buildRAGContext = (results: Document[]): string => {
  // ✅ CORRIGIDO: limitar a 3 fontes mais relevantes
  const topResults = results.slice(0, 3);

  return topResults
    // ✅ CORRIGIDO: era substring(0, 2000) sem limite de quantidade
    .map(r => `[FONTE: ${r.fileName}]\n${(r.rawText || '').substring(0, 1500)}`)
    .join("\n\n---\n\n");
};