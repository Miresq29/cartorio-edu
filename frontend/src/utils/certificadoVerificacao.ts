import { collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

// Hash de verificação do certificado — mesma fórmula usada pela cloud function
// verificarCertificado (functions/src/index.ts). Precisa do ID real do documento, por isso
// certificados sempre nascem em 2 passos: addDoc, calcula o hash, updateDoc com o código.
export async function gerarHashVerificacao(
  docId: string, colaboradorId: string, trilhaTitulo: string, notaFinal: number, tenantId: string
): Promise<string> {
  const input = `${docId}|${colaboradorId}|${trilhaTitulo}|${notaFinal}|${tenantId}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const code = hex.slice(0, 16);
  return `MJ-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

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

// Busca um certificado já emitido pro mesmo colaborador+treinamento+tenant, ou cria um novo
// — nunca duplica. Usado por todo fluxo de emissão (manual, em lote, ou o certificado exibido
// na hora logo após passar num exame) pra garantir um único registro por par colaborador+item.
// A combinação trilhaTitulo+tipo(+moduloTitulo) é o que identifica "o mesmo certificado" —
// um "exame" e um "módulo" da mesma trilha são certificados distintos, não duplicata um do outro.
export async function obterOuCriarCertificado(dados: DadosCertificado): Promise<{ id: string; codigoVerificacao: string; novo: boolean }> {
  const candidatosSnap = await getDocs(query(
    collection(db, 'certificados'),
    where('colaboradorId', '==', dados.colaboradorId),
    where('trilhaTitulo', '==', dados.trilhaTitulo),
    where('tipo', '==', dados.tipo),
    where('tenantId', '==', dados.tenantId),
  ));
  const existente = candidatosSnap.docs.find(d => (d.data().moduloTitulo || '') === (dados.moduloTitulo || ''));
  if (existente) {
    return { id: existente.id, codigoVerificacao: existente.data().codigoVerificacao, novo: false };
  }

  const validoAte = new Date();
  validoAte.setFullYear(validoAte.getFullYear() + 1);
  const ref = await addDoc(collection(db, 'certificados'), {
    ...dados,
    emitidoEm: serverTimestamp(),
    validoAte: validoAte.toISOString(),
  });
  const codigoVerificacao = await gerarHashVerificacao(ref.id, dados.colaboradorId, dados.trilhaTitulo, dados.notaFinal, dados.tenantId);
  await updateDoc(ref, { codigoVerificacao });
  return { id: ref.id, codigoVerificacao, novo: true };
}
