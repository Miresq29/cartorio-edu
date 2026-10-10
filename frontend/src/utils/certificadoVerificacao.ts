import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

// URL da página pública de verificação (fora do login) — usada no QR e no link do certificado.
export const VERIFICACAO_BASE_URL = 'https://cartorio-edu.vercel.app/verificar';

export interface DadosCertificado {
  colaboradorId: string;
  colaboradorNome: string;
  cargo: string;
  cartorio: string;
  trilhaTitulo: string;
  moduloTitulo?: string;
  tipo: 'trilha' | 'modulo' | 'exame';
  notaFinal: number;
  cargaHoraria: number;
  instrutor?: string;
  tenantId: string;
  emitidoPor: string;
}

const emitirCertificadoManualFn = httpsCallable<
  {
    colaboradorId: string;
    trilhaTitulo: string;
    moduloTitulo?: string;
    tipo: string;
    notaFinal: number;
    cargaHoraria: number;
  },
  { id: string; codigoVerificacao: string; novo: boolean }
>(functions, 'emitirCertificadoManual');

// Emite (ou reaproveita, se já existir) o certificado oficial pro colaborador+treinamento.
// O cliente não grava mais direto em certificados/ — a coleção é somente-leitura pro cliente
// (ver firestore.rules); quem cria o documento é sempre a Cloud Function emitirCertificadoManual,
// que confirma o colaborador, preenche os dados oficiais (serventia, assinatura/instrutor vindos
// da config global) e calcula o hash de verificação.
export async function obterOuCriarCertificado(dados: DadosCertificado): Promise<{ id: string; codigoVerificacao: string; novo: boolean }> {
  const { data } = await emitirCertificadoManualFn({
    colaboradorId: dados.colaboradorId,
    trilhaTitulo: dados.trilhaTitulo,
    moduloTitulo: dados.moduloTitulo,
    tipo: dados.tipo,
    notaFinal: dados.notaFinal,
    cargaHoraria: dados.cargaHoraria,
  });
  return { id: data.id, codigoVerificacao: data.codigoVerificacao, novo: data.novo };
}
