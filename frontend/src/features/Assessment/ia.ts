import { GeminiService } from '../../services/geminiService';
import { Assessment, ResumoExecutivo } from './types';
import { DIMENSOES } from './constants';
import { situacaoScore, labelNivel } from './scoring';

export interface ResumoIA {
  resumoExecutivo: ResumoExecutivo;
  recomendacoesPorDim: Record<string, string>;
}

const RESUMO_VAZIO: ResumoExecutivo = { cabecalho: '', introducao: '', objetivo: '', analiseGeral: '' };

// Extrai JSON de uma resposta livre, tolerando markdown/backticks/preâmbulo.
function parseResumoIA(texto: string, periodo: string): ResumoIA {
  const cleaned = texto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      if (parsed && parsed.resumoExecutivo && typeof parsed.resumoExecutivo === 'object') {
        const r = parsed.resumoExecutivo;
        return {
          resumoExecutivo: {
            cabecalho: typeof r.cabecalho === 'string' ? r.cabecalho : `Diagnóstico de Maturidade — ${periodo}`,
            introducao: typeof r.introducao === 'string' ? r.introducao : '',
            objetivo: typeof r.objetivo === 'string' ? r.objetivo : '',
            analiseGeral: typeof r.analiseGeral === 'string' ? r.analiseGeral : '',
          },
          recomendacoesPorDim: parsed.recomendacoesPorDim && typeof parsed.recomendacoesPorDim === 'object' ? parsed.recomendacoesPorDim : {},
        };
      }
    } catch { /* cai no fallback abaixo */ }
  }
  // Fallback: JSON malformado ou em formato antigo — usa o texto puro como análise geral.
  return {
    resumoExecutivo: { ...RESUMO_VAZIO, cabecalho: `Diagnóstico de Maturidade — ${periodo}`, analiseGeral: cleaned },
    recomendacoesPorDim: {},
  };
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

  const prompt = `Você é especialista em conformidade notarial (Provimentos CNJ e LGPD) da MJ Consultoria, redigindo o resumo executivo de um diagnóstico de maturidade em segurança da informação para apresentação à liderança da serventia.

Diagnóstico — período: ${assessment.periodo}.
Score global: ${assessment.scoreGlobal}% | Nível: ${labelNivel(assessment.nivel)}${assessment.bloqueado ? ' (travado por dimensão bloqueadora abaixo de 40%)' : ''}.

DIMENSÕES COM GAP (score abaixo de 80%) E SUA BASE LEGAL ESPECÍFICA:
${blocoDimensoes}

INSTRUÇÕES:
Estruture "resumoExecutivo" em 4 campos distintos, formais e em português:
1. "cabecalho": um título curto (até 10 palavras) para este diagnóstico, incluindo o período.
2. "introducao": 2 a 3 frases contextualizando o que foi avaliado (10 dimensões de segurança da informação e LGPD) e por que este diagnóstico existe.
3. "objetivo": 2 a 3 frases explicando o objetivo do diagnóstico — apoiar a corregedoria e a própria gestão a identificar riscos e planejar ações corretivas.
4. "analiseGeral": um parágrafo (6 a 10 frases) analisando o score global, o nível de maturidade e as dimensões com gap, citando SOMENTE os artigos/dispositivos listados acima para cada dimensão — nunca cite um Provimento genericamente para uma dimensão que não o lista. Se não houver gaps, elogie a maturidade e cite de forma breve os Provimentos CNJ 149 e 213 e a LGPD.

Além disso, escreva "recomendacoesPorDim": um objeto onde cada chave é o "id" de uma dimensão com gap listada acima, e o valor é uma recomendação prática de 1 a 2 frases para aquela dimensão, citando o artigo específico dela (o mesmo indicado na base legal acima, não outro). Se não houver dimensões com gap, retorne um objeto vazio {}.

Responda ESTRITAMENTE em JSON válido, sem markdown, sem blocos de código (sem \`\`\`), sem nenhum texto antes ou depois do JSON. Formato exato:
{"resumoExecutivo": {"cabecalho": "...", "introducao": "...", "objetivo": "...", "analiseGeral": "..."}, "recomendacoesPorDim": {"idDaDimensao": "..."}}`;

  const texto = await GeminiService.generateJSON(prompt, 2500);
  return parseResumoIA(texto, assessment.periodo);
}
