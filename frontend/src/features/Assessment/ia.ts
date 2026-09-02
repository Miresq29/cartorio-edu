import { GeminiService } from '../../services/geminiService';
import { Assessment } from './types';
import { DIMENSOES } from './constants';
import { situacaoScore } from './scoring';

export interface ResumoIA {
  resumoExecutivo: string;
  recomendacoesPorDim: Record<string, string>;
}

// Extrai JSON de uma resposta livre, tolerando markdown/backticks/preâmbulo.
function parseResumoIA(texto: string): ResumoIA {
  const cleaned = texto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      if (parsed && typeof parsed.resumoExecutivo === 'string') {
        return {
          resumoExecutivo: parsed.resumoExecutivo,
          recomendacoesPorDim: parsed.recomendacoesPorDim && typeof parsed.recomendacoesPorDim === 'object' ? parsed.recomendacoesPorDim : {},
        };
      }
    } catch { /* cai no fallback abaixo */ }
  }
  // Fallback: JSON malformado — usa o texto puro como resumo executivo.
  return { resumoExecutivo: cleaned, recomendacoesPorDim: {} };
}

export async function gerarResumoIA(assessment: Assessment): Promise<ResumoIA> {
  const dimensoesComGap = DIMENSOES
    .map(d => ({ dim: d, score: assessment.scoresPorDim[d.id] ?? 0 }))
    .filter(x => situacaoScore(x.score) !== 'adequado');

  const blocoDimensoes = dimensoesComGap.length > 0
    ? dimensoesComGap.map(x =>
        `- ${x.dim.nome} (id: ${x.dim.id}): score ${x.score}%, situação ${situacaoScore(x.score)}. Base legal aplicável a esta dimensão: ${x.dim.ref}.`
      ).join('\n')
    : 'Nenhuma dimensão com gap — todas as dimensões estão adequadas (score ≥ 60%).';

  const prompt = `Você é especialista em conformidade notarial (Provimentos CNJ e LGPD) da MJ Consultoria.

Diagnóstico de maturidade em segurança da informação — período: ${assessment.periodo}.
Score global: ${assessment.scoreGlobal}% | Nível: ${assessment.nivel}${assessment.bloqueado ? ' (travado por dimensão bloqueadora abaixo de 40%)' : ''}.

DIMENSÕES COM GAP (score abaixo de 80%) E SUA BASE LEGAL ESPECÍFICA:
${blocoDimensoes}

INSTRUÇÕES:
1. Escreva um "resumoExecutivo": um parágrafo formal (6 a 10 frases) descrevendo o nível de maturidade da serventia, citando SOMENTE os artigos/dispositivos listados acima para cada dimensão com gap — nunca cite um Provimento genericamente para uma dimensão que não o lista. Se não houver gaps, elogie a maturidade e cite de forma breve os Provimentos CNJ 149 e 213 e a LGPD.
2. Escreva "recomendacoesPorDim": um objeto onde cada chave é o "id" de uma dimensão com gap listada acima, e o valor é uma recomendação prática de 1 a 2 frases para aquela dimensão, citando o artigo específico dela (o mesmo indicado na base legal acima, não outro).
3. Se não houver dimensões com gap, retorne "recomendacoesPorDim" como um objeto vazio {}.

Responda ESTRITAMENTE em JSON válido, sem markdown, sem blocos de código (sem \`\`\`), sem nenhum texto antes ou depois do JSON. Formato exato:
{"resumoExecutivo": "...", "recomendacoesPorDim": {"idDaDimensao": "..."}}`;

  const texto = await GeminiService.generateJSON(prompt, 2000);
  return parseResumoIA(texto);
}
