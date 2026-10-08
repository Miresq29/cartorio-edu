
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, AppTab } from '../types';
import { AuthService } from '../services/authService';
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { TipoOrganizacao } from '../utils/terminologia';

interface AppState {
  user: User | null;
  token: string | null;
  activeTab: AppTab;
  loading: boolean;
  activeTenantId: string | null;
  activeTenantName: string | null;
}

interface AppContextType {
  state: AppState;
  login: (user: User, token: string) => void;
  logout: () => void;
  setActiveTab: (tab: AppTab) => void;
  setActiveTenant: (id: string | null, name?: string | null) => void;
  /** tenantId efetivo: activeTenantId quando SUPERADMIN está em modo cartório, senão user.tenantId */
  tenantId: string;
  /** tipo de organização do tenant em foco — define se a UI fala "cartório" ou "empresa" */
  tipoOrganizacao: TipoOrganizacao;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    user: null,
    token: null,
    activeTab: 'dashboard',
    loading: true,
    activeTenantId: null,
    activeTenantName: null,
  });

  // Console Master (dashboard) e as demais telas de Sistema Master mostram dados agregados de
  // TODOS os cartorios — so SUPERADMIN/Equipe MJ devem cair ali por padrao ao logar.
  const tabInicial = (role?: string) => (role === 'SUPERADMIN' || role === 'equipe_mj') ? 'dashboard' : 'unit';

  useEffect(() => {
    const unsubscribe = AuthService.onAuthUpdate((user, token) => {
      setState(prev => ({
        ...prev,
        user,
        token,
        loading: false,
        activeTab: tabInicial(user?.role),
        // Reset tenant mode ao trocar de usuário
        activeTenantId: null,
        activeTenantName: null,
      }));
    });
    return () => unsubscribe();
  }, []);

  const login = useMemo(() => (user: User, token: string) => {
    setState(prev => ({ ...prev, user, token, activeTab: tabInicial(user?.role), activeTenantId: null, activeTenantName: null }));
  }, []);

  const logout = useMemo(() => async () => {
    await AuthService.logout();
    setState({ user: null, token: null, activeTab: 'dashboard', loading: false, activeTenantId: null, activeTenantName: null });
  }, []);

  const setActiveTab = useMemo(() => (tab: AppTab) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const setActiveTenant = useMemo(() => (id: string | null, name: string | null = null) => {
    setState(prev => ({ ...prev, activeTenantId: id, activeTenantName: name }));
  }, []);

  // Equipe MJ (staff interno, sem cartório fixo) usa o mesmo modo de preview que o SUPERADMIN.
  const isPlatformStaff = state.user?.role === 'SUPERADMIN' || state.user?.role === 'equipe_mj';

  const tenantId = (isPlatformStaff && state.activeTenantId)
    ? state.activeTenantId
    : state.user?.tenantId ?? '';

  const [tipoOrganizacao, setTipoOrganizacao] = useState<TipoOrganizacao>('cartorio');

  // Acompanha o tenant em foco: define se a UI fala "cartório" ou "empresa" e, para quem
  // pertence de fato ao tenant (não staff em preview), derruba a sessão em tempo real se o
  // cartório do usuário logado for desativado (ex.: demonstração expirada).
  useEffect(() => {
    if (!tenantId) { setTipoOrganizacao('cartorio'); return; }
    return onSnapshot(doc(db, 'tenants', tenantId), snap => {
      const data = snap.data();
      setTipoOrganizacao(data?.tipoOrganizacao === 'empresa' ? 'empresa' : 'cartorio');
      if (!isPlatformStaff && snap.exists() && data?.active === false) logout();
    });
  }, [tenantId, isPlatformStaff]);

  const contextValue = useMemo(() => ({
    state, login, logout, setActiveTab, setActiveTenant, tenantId, tipoOrganizacao,
  }), [state, login, logout, setActiveTab, setActiveTenant, tenantId, tipoOrganizacao]);

  return (
    <AppContext.Provider value={contextValue}>
      {!state.loading && children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp deve ser usado dentro de um AppProvider');
  }
  return context;
};
