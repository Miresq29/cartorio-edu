// IDs dos itens do Repositório liberados para o cliente (ativos, com o cliente ou GLOBAL em
// tenantIds). Usado para esconder módulos/trilhas cujo vídeo a equipe MJ ainda não liberou para
// este cliente — a liberação é decisão da equipe MJ, caso a caso.
// Devolve null enquanto carrega; `desligado` (equipe da plataforma) não consulta nada.
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useItensLiberados(tenantId: string | undefined, desligado = false) {
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (desligado) { setIds(null); return; }
    if (!tenantId) { setIds(new Set()); return; }
    return onSnapshot(
      query(collection(db, 'repositorio'), where('tenantIds', 'array-contains-any', [tenantId, 'GLOBAL'])),
      snap => setIds(new Set(snap.docs.filter(d => d.data().ativo !== false).map(d => d.id))),
      () => setIds(new Set()),
    );
  }, [tenantId, desligado]);
  return ids;
}

// Módulo liberado: não aponta para o Repositório, ou aponta para um item liberado ao cliente.
export function moduloLiberado(m: { conteudoRef?: { tipo: string; itemId: string } }, liberados: Set<string> | null): boolean {
  if (!liberados) return true;
  return !m.conteudoRef || m.conteudoRef.tipo !== 'repositorio' || liberados.has(m.conteudoRef.itemId);
}
