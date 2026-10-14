// Leitura do trilhasProgresso como o servidor grava (functions/src/index.ts → salvarProgresso):
// UM documento por pessoa + trilha, com o estado de cada módulo em `modulos` e a conclusão da
// trilha em `concluida` / `percentualObrigatorios`. Usado pelo Meu Progresso e pelo painel do
// colaborador (badges, módulos concluídos, trilhas concluídas).

export interface ProgressoTrilhaDoc {
  trilhaId: string;
  trilhaTitulo?: string;
  concluida?: boolean;
  percentualObrigatorios?: number;
  modulos?: Record<string, { assistido?: boolean; aprovado?: boolean }>;
}

interface TrilhaComModulos { id: string; modulos?: { id: string; temQuiz?: boolean }[] }

// Mesmo critério do servidor (gerarExame / emitirCertificado).
export function trilhaConcluida(p: ProgressoTrilhaDoc): boolean {
  return p.concluida === true || p.percentualObrigatorios === 100;
}

// Módulo concluído = assistido e, se tiver quiz, aprovado (regra de calcularPercentual no servidor).
// Só conta módulos que ainda existem na trilha, para não passar do total.
export function modulosConcluidos(p: ProgressoTrilhaDoc | undefined, trilha: TrilhaComModulos | undefined): number {
  if (!p?.modulos || !trilha?.modulos) return 0;
  return trilha.modulos.filter(m => {
    const e = p.modulos![m.id];
    return !!e?.assistido && (!m.temQuiz || !!e.aprovado);
  }).length;
}

export function progressoDaTrilha<T extends ProgressoTrilhaDoc>(progresso: T[], trilhaId: string): T | undefined {
  return progresso.find(p => p.trilhaId === trilhaId);
}
