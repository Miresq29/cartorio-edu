import { DIMENSOES, NIVEL_LABELS, GAP_TRILHAS } from './constants';
import { Assessment, GapItem, NivelMaturidade, RespostaDim, RespostaIndicador } from './types';

// Score de uma dimensão (0-100), ponderado pelo peso de cada indicador.
export function calcularScoreDim(respostas: RespostaIndicador[]): number {
  if (respostas.length === 0) return 0;
  const maxPossivel = respostas.reduce((a, r) => a + r.peso * 100, 0);
  const obtido = respostas.reduce((a, r) => {
    if (r.tipo === 'sim_nao' || r.tipo === 'documento') return a + (r.resposta ? r.peso * 100 : 0);
    if (r.tipo === 'metrica') return a + ((typeof r.resposta === 'number' ? r.resposta : 0) * r.peso);
    return a;
  }, 0);
  return maxPossivel === 0 ? 0 : Math.round((obtido / maxPossivel) * 100);
}

// Score global (0-100): média das dimensões ponderada pelo peso de cada uma.
export function calcularScoreGlobal(dims: RespostaDim[]): number {
  const total = DIMENSOES.reduce((a, d) => {
    const rd = dims.find(x => x.dimId === d.id);
    return a + (rd ? (rd.scoreDim * d.peso) / 100 : 0);
  }, 0);
  return Math.round(total);
}

// Regra de bloqueio: se alguma dimensão bloqueadora (Capacitação, LGPD) ficar
// abaixo de 40%, o nível fica travado em no máximo 2, independente do score global.
export function calcularNivel(scoreGlobal: number, scoresPorDim: Record<string, number>): { nivel: NivelMaturidade; bloqueado: boolean } {
  const bloqueadoras = DIMENSOES.filter(d => d.bloqueadora);
  const bloqueado = bloqueadoras.some(d => (scoresPorDim[d.id] ?? 0) < 40);
  const scoreEfetivo = bloqueado ? Math.min(scoreGlobal, 39) : scoreGlobal;
  const nivel: NivelMaturidade =
    scoreEfetivo < 20 ? 1 :
    scoreEfetivo < 40 ? 2 :
    scoreEfetivo < 60 ? 3 :
    scoreEfetivo < 80 ? 4 : 5;
  return { nivel, bloqueado };
}

export function labelNivel(nivel: number): string {
  return NIVEL_LABELS[nivel] || '';
}

// Situação semântica de uma dimensão/indicador pelo score.
export function situacaoScore(score: number): 'critico' | 'gap' | 'adequado' {
  if (score < 40) return 'critico';
  if (score < 60) return 'gap';
  return 'adequado';
}

// Monta a lista de gaps (indicadores não atendidos) com a trilha recomendada,
// a partir das respostas de todas as dimensões.
export function calcularGaps(dims: RespostaDim[]): GapItem[] {
  const gaps: GapItem[] = [];
  for (const dim of dims) {
    const dimDef = DIMENSOES.find(d => d.id === dim.dimId);
    if (!dimDef) continue;
    for (const ri of dim.indicadores) {
      const indDef = dimDef.indicadores.find(i => i.id === ri.indId);
      if (!indDef) continue;
      const atendido = ri.tipo === 'metrica'
        ? (typeof ri.resposta === 'number' ? ri.resposta : 0) >= 70
        : ri.resposta === true;
      if (atendido) continue;

      const recomendacoes = GAP_TRILHAS[ri.indId];
      if (!recomendacoes) continue;
      for (const rec of recomendacoes) {
        gaps.push({
          dimId: dim.dimId,
          indId: ri.indId,
          textoIndicador: indDef.texto,
          prioridade: rec.prioridade,
          trilhaRecomendada: rec.trilha,
          prazoSugerido: rec.prazo,
        });
      }
    }
  }
  const ordemPrioridade = { urgente: 0, alta: 1, baixa: 2 };
  return gaps.sort((a, b) => ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade]);
}

// Consolida um assessment completo a partir das respostas por dimensão.
export function montarAssessment(
  respostas: RespostaDim[],
  base: Pick<Assessment, 'tenantId' | 'respondidoPor' | 'respondidoPorNome' | 'periodo'>
): Omit<Assessment, 'id' | 'criadoEm' | 'atualizadoEm' | 'respondidoEm'> {
  const scoresPorDim: Record<string, number> = {};
  respostas.forEach(r => { scoresPorDim[r.dimId] = r.scoreDim; });

  const scoreGlobal = calcularScoreGlobal(respostas);
  const { nivel, bloqueado } = calcularNivel(scoreGlobal, scoresPorDim);
  const gaps = calcularGaps(respostas);

  return {
    ...base,
    respostas,
    scoreGlobal,
    nivel,
    bloqueado,
    scoresPorDim,
    gaps,
    status: 'concluido',
  };
}
