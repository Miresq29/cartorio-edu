// Setores do cliente (tenants/{tenantId}.setores) — cada cliente cria os seus na tela de
// Colaboradores; usados no cadastro do colaborador, no público-alvo das trilhas e no
// relatório de erros por setor.
import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useSetoresTenant(tenantId: string | undefined) {
  const [setores, setSetores] = useState<string[]>([]);

  useEffect(() => {
    setSetores([]);
    if (!tenantId) return;
    return onSnapshot(doc(db, 'tenants', tenantId),
      snap => setSetores(((snap.data()?.setores as string[]) || []).slice().sort((a, b) => a.localeCompare(b, 'pt-BR'))),
      () => setSetores([]));
  }, [tenantId]);

  const salvarSetores = async (lista: string[]) => {
    if (!tenantId) return;
    const limpa = Array.from(new Set(lista.map(s => s.trim()).filter(Boolean)));
    await updateDoc(doc(db, 'tenants', tenantId), { setores: limpa });
  };

  return { setores, salvarSetores };
}
