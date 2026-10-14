// Leitura do trilhasProgresso como o servidor grava (functions/src/index.ts → salvarProgresso):
// UM documento por pessoa + trilha, com o estado de cada módulo em `modulos` e a conclusão da
// trilha em `concluida` / `percentualObrigatorios`. Usado pelo Meu Progresso e pelo painel do
// colaborador (badges, módulos concluídos, trilhas concluídas).
import { moduloLiberado } from '../hooks/useItensLiberados';

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

// Trilhas que contam para o aluno — mesma regra da tela Trilhas (TrailsView → minhasTrilhas):
// ativa, para o perfil e o setor da pessoa, e com conteúdo liberado pela equipe MJ ao cliente.
// Módulos não liberados saem; trilha sem nenhum módulo liberado só fica para quem já tem
// progresso nela (histórico). `liberados` null = ainda carregando (não mostra nada).
// Sem `pessoa` (painel da gestão): não filtra por perfil/setor, só pela liberação.
interface TrilhaVisivel { id: string; ativa?: boolean; perfis?: string[]; setores?: string[]; modulos?: any[] }
export function trilhasDoAluno<T extends TrilhaVisivel>(
  trilhas: T[], liberados: Set<string> | null, progresso: ProgressoTrilhaDoc[], pessoa?: { role: string; setor: string },
): T[] {
  if (!liberados) return [];
  const comHistorico = new Set(progresso.map(p => p.trilhaId));
  return trilhas.flatMap(t => {
    if (pessoa) {
      if (t.ativa === false || (t.perfis && !t.perfis.includes(pessoa.role))) return [];
      if ((t.setores || []).length && !(t.setores || []).includes(pessoa.setor)) return [];
    }
    const todos = t.modulos || [];
    const modulos = todos.filter(m => moduloLiberado(m, liberados));
    if (modulos.length) return [modulos.length === todos.length ? t : { ...t, modulos }];
    return comHistorico.has(t.id) ? [t] : [];
  });
}

export function progressoDaTrilha<T extends ProgressoTrilhaDoc>(progresso: T[], trilhaId: string): T | undefined {
  return progresso.find(p => p.trilhaId === trilhaId);
}
