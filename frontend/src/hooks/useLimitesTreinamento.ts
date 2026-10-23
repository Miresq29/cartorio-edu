// Limite de treinamentos por colaborador (tenants/{tenantId}.limitesTreinamento) — quantas trilhas
// concluídas + provas aprovadas cada colaborador do cliente pode somar por dia, semana e mês.
// A contagem e o bloqueio ficam nas functions (gerarExame, marcarModuloAssistido, gerarQuizModulo).
import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface LimitesTreinamento { dia: number | null; semana: number | null; mes: number | null }

const SEM_LIMITE: LimitesTreinamento = { dia: null, semana: null, mes: null };

export function useLimitesTreinamento(tenantId: string | undefined) {
  const [limites, setLimites] = useState<LimitesTreinamento>(SEM_LIMITE);

  useEffect(() => {
    setLimites(SEM_LIMITE);
    if (!tenantId) return;
    return onSnapshot(doc(db, 'tenants', tenantId),
      snap => setLimites({ ...SEM_LIMITE, ...((snap.data()?.limitesTreinamento as Partial<LimitesTreinamento>) || {}) }),
      () => setLimites(SEM_LIMITE));
  }, [tenantId]);

  const salvarLimites = async (novos: LimitesTreinamento) => {
    if (!tenantId) return;
    const limpa = (v: number | null) => (v && v > 0 ? Math.min(100, Math.round(v)) : null);
    await updateDoc(doc(db, 'tenants', tenantId), {
      limitesTreinamento: { dia: limpa(novos.dia), semana: limpa(novos.semana), mes: limpa(novos.mes) },
    });
  };

  return { limites, salvarLimites };
}
