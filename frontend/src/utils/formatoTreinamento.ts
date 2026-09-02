// Forma de treinamento compartilhada entre TrailsView (cadastro de trilhas/treinamentos)
// e RelatoriosView (exibição em relatórios) — mantida em um único lugar para não
// dessincronizar caso um novo formato seja adicionado no futuro.

export type FormatoTreinamento = 'ead' | 'presencial' | 'hibrida';

export const FORMATOS: { value: FormatoTreinamento; label: string; icon: string }[] = [
  { value: 'ead', label: 'EAD', icon: 'fa-laptop' },
  { value: 'presencial', label: 'Presencial', icon: 'fa-chalkboard-user' },
  { value: 'hibrida', label: 'Híbrida', icon: 'fa-shuffle' },
];

export const FORMATO_LABEL: Record<string, string> = { ead: 'EAD', presencial: 'Presencial', hibrida: 'Híbrida' };
