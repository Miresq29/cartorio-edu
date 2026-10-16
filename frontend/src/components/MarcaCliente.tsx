// "Marca própria" (recurso por cliente, configurado só pela equipe MJ em Gestão de Empresas):
// lê tenants/{id}.marcaHabilitada + .marca e aplica as cores e o logo em toda a plataforma.
// Também guarda a marca no navegador para a tela de entrada (antes do login não se sabe o
// cliente). No modo "Visualizando <cliente>" vale a marca do cliente visualizado.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useApp } from '../context/AppContext';
import { MarcaCliente, aplicarTema, calcularTema, definirLogoAtual } from '../utils/tema';

const CHAVE = 'integra-marca';
interface MarcaAtiva { logo: string; nome: string; ativa: boolean }
const Ctx = createContext<MarcaAtiva>({ logo: '', nome: '', ativa: false });
export const useMarca = () => useContext(Ctx);

function lerCache(): { marca: MarcaCliente; nome: string } | null {
  try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch { return null; }
}

function aplicar(marca: MarcaCliente | null): void {
  aplicarTema(marca ? calcularTema(marca) : null);
  definirLogoAtual(marca?.logo || '');
}

export const MarcaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, tenantId } = useApp();
  const logado = !!state.user;
  const [ativa, setAtiva] = useState<MarcaAtiva>(() => {
    const c = lerCache();
    return c ? { logo: c.marca.logo || '', nome: c.nome, ativa: true } : { logo: '', nome: '', ativa: false };
  });

  // Antes do login: usa a última marca vista neste navegador.
  useEffect(() => {
    if (logado) return;
    const c = lerCache();
    aplicar(c?.marca || null);
    setAtiva(c ? { logo: c.marca.logo || '', nome: c.nome, ativa: true } : { logo: '', nome: '', ativa: false });
  }, [logado]);

  useEffect(() => {
    if (!logado) return;
    if (!tenantId) { aplicar(null); setAtiva({ logo: '', nome: '', ativa: false }); return; }
    return onSnapshot(doc(db, 'tenants', tenantId), snap => {
      const d = snap.data() || {};
      const marca: MarcaCliente | null = d.marcaHabilitada === true && d.marca ? d.marca : null;
      aplicar(marca);
      const nome = String(marca?.nomeExibicao || d.name || '');
      setAtiva(marca ? { logo: marca.logo || '', nome, ativa: true } : { logo: '', nome: '', ativa: false });
      // Só a marca do próprio cliente da pessoa vai para a tela de entrada (não a de um cliente
      // que a equipe MJ esteja apenas visualizando).
      if (!state.activeTenantId) {
        try {
          if (marca) localStorage.setItem(CHAVE, JSON.stringify({ marca, nome }));
          else localStorage.removeItem(CHAVE);
        } catch { /* sem armazenamento */ }
      }
    }, () => { aplicar(null); setAtiva({ logo: '', nome: '', ativa: false }); });
  }, [logado, tenantId, state.activeTenantId]);

  return <Ctx.Provider value={ativa}>{children}</Ctx.Provider>;
};
