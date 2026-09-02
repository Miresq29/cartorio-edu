// Tipos do módulo de Diagnóstico de Maturidade em Segurança da Informação.

export type TipoIndicador = 'sim_nao' | 'documento' | 'metrica';

export interface Indicador {
  id: string;              // ex: "cap.1"
  tipo: TipoIndicador;
  peso: number;            // 2 (sim_nao) | 3 (documento) | 1 (metrica)
  texto: string;
}

export interface Dimensao {
  id: string;               // ex: "cap"
  nome: string;
  peso: number;             // % do score total
  bloqueadora: boolean;     // se < 40%, trava o nível máximo em 2
  ref: string;              // base legal (Provimentos CNJ / LGPD)
  desc: string;
  indicadores: Indicador[];
}

export interface RespostaIndicador {
  indId: string;
  tipo: TipoIndicador;
  resposta: boolean | number | null;
  peso: number;
}

export interface RespostaDim {
  dimId: string;
  indicadores: RespostaIndicador[];
  scoreDim: number;         // 0-100
}

export type PrioridadeGap = 'urgente' | 'alta' | 'baixa';

export interface GapItem {
  dimId: string;
  indId: string;
  textoIndicador: string;
  prioridade: PrioridadeGap;
  trilhaRecomendada: string;
  prazoSugerido: string;
}

export type NivelMaturidade = 1 | 2 | 3 | 4 | 5;

export interface Assessment {
  id: string;
  tenantId: string;
  respondidoPor: string;             // uid Firebase
  respondidoPorNome: string;
  respondidoEm: any;                 // Firestore Timestamp
  periodo: string;                   // ex: "Janeiro–Junho 2026"
  respostas: RespostaDim[];
  scoreGlobal: number;               // 0-100, ponderado
  nivel: NivelMaturidade;
  bloqueado: boolean;                // true se alguma dimensão bloqueadora < 40%
  scoresPorDim: Record<string, number>;
  gaps: GapItem[];
  resumoExecutivo?: string;          // gerado por IA
  recomendacoesPorDim?: Record<string, string>; // gerado por IA
  status: 'rascunho' | 'concluido';
  criadoEm: any;
  atualizadoEm?: any;
}
