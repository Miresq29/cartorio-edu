// Hook compartilhado para módulos que podem ser habilitados/desabilitados por cartório
// (tenants/{tenantId}.<campo>) — usado tanto pelos recursos opcionais historicamente
// vendidos à parte (phishing, backup — padrão OFF até o SUPERADMIN habilitar) quanto
// pelos módulos suspensos apenas durante o período de demonstração (padrão ON, exceto
// quando o SUPERADMIN os desativa — normalmente ao ativar uma demonstração).
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useApp } from '../context/AppContext';

// Campos cujo padrão é DESLIGADO até o SUPERADMIN habilitar explicitamente.
// Os demais campos usados com este hook têm padrão LIGADO (só desligam se
// o SUPERADMIN gravar `false`, como acontece ao ativar uma demonstração).
const PADRAO_DESLIGADO = new Set(['phishingHabilitado', 'backupHabilitado']);

// "criarConteudoHabilitado" trava o CLIENTE (gestor/admin do cartório) durante a
// demonstração, mas nunca deve travar o próprio SUPERADMIN — criar/distribuir
// conteúdo oficial é uma ação da plataforma, não "o que o cliente veria", então o
// bypass vale mesmo com o SUPERADMIN "dentro" de um cartório em modo demonstração.
const SEMPRE_LIBERADO_PARA_SUPERADMIN = new Set(['criarConteudoHabilitado']);

export function useRecursoTenant(campo: string) {
  const { state, tenantId } = useApp();
  const padraoLigado = !PADRAO_DESLIGADO.has(campo);
  const [habilitado, setHabilitado] = useState(padraoLigado);

  const isSuperAdmin = state.user?.role === 'SUPERADMIN';
  // No modo global (fora de qualquer cartório) o SUPERADMIN sempre enxerga o recurso
  // destravado. Ao "entrar" num cartório específico (activeTenantId), deve ver
  // exatamente o que aquele cliente vê — inclusive travado, para conferir a config —
  // exceto os campos em SEMPRE_LIBERADO_PARA_SUPERADMIN, que nunca travam para ele.
  const superAdminGlobal = isSuperAdmin && (!state.activeTenantId || SEMPRE_LIBERADO_PARA_SUPERADMIN.has(campo));

  useEffect(() => {
    if (!tenantId) { setHabilitado(padraoLigado); return; }
    return onSnapshot(doc(db, 'tenants', tenantId), snap => {
      const valor = snap.data()?.[campo];
      setHabilitado(padraoLigado ? valor !== false : !!valor);
    });
  }, [tenantId, campo, padraoLigado]);

  return { habilitado, podeUsar: superAdminGlobal || habilitado, superAdminGlobal };
}
