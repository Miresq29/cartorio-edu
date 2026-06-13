
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, AppTab } from '../types';
import { AuthService } from '../services/authService';

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

  useEffect(() => {
    const unsubscribe = AuthService.onAuthUpdate((user, token) => {
      setState(prev => ({
        ...prev,
        user,
        token,
        loading: false,
        // Reset tenant mode ao trocar de usuário
        activeTenantId: null,
        activeTenantName: null,
      }));
    });
    return () => unsubscribe();
  }, []);

  const login = useMemo(() => (user: User, token: string) => {
    setState(prev => ({ ...prev, user, token, activeTenantId: null, activeTenantName: null }));
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

  const tenantId = (state.user?.role === 'SUPERADMIN' && state.activeTenantId)
    ? state.activeTenantId
    : state.user?.tenantId ?? '';

  const contextValue = useMemo(() => ({
    state, login, logout, setActiveTab, setActiveTenant, tenantId,
  }), [state, login, logout, setActiveTab, setActiveTenant, tenantId]);

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
