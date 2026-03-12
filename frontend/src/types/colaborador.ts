// frontend/src/types/colaborador.ts
// Cole este conteúdo no arquivo que você criou

export type ColaboradorRole = 'gestor' | 'atendente' | 'auditor' | 'viewer';

export type ColaboradorCargo =
  | 'Tabelião'
  | 'Oficial de Registro'
  | 'Escrevente Autorizado'
  | 'Escrevente'
  | 'Auxiliar Administrativo'
  | 'Responsável PLD'
  | 'Outro';

export interface Colaborador {
  id: string;
  tenantId: string;
  uid?: string | null;
  nome: string;
  cpfMask: string;       // "***.***.123-45" — nunca o CPF real
  cpfHash: string;       // SHA-256 do CPF limpo (para busca)
  cargo: ColaboradorCargo | string;
  email: string;
  role: ColaboradorRole;
  ativo: boolean;
  conviteEnviado: boolean;
  conviteAceito: boolean;
  criadoEm: any;
  atualizadoEm?: any;
  criadoPor: string;
}

export type ColaboradorCreatePayload = Omit<
  Colaborador,
  'id' | 'uid' | 'conviteAceito' | 'criadoEm' | 'atualizadoEm'
>;