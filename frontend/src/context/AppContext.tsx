
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AppTab } from '../types';
import { AuthService } from '../services/authService';

interface AppState {
  user: User | null;
  token: string | null;
  activeTab: AppTab;
  loading: boolean;
}

interface AppContextType {
  state: AppState;
  login: (user: User, token: string) => void;
  logout: () => void;
  setActiveTab: (tab: AppTab) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    user: null,
    token: null,
    activeTab: 'dashboard',
    loading: true,
  });

  // Monitora o estado de autenticação em tempo real
  useEffect(() => {
    const unsubscribe = AuthService.onAuthUpdate((user, token) => {
      setState(prev => ({ ...prev, user, token, loading: false }));
    });
    return () => unsubscribe();
  }, []);

  const login = (user: User, token: string) => {
    setState(prev => ({ ...prev, user, token }));
  };

  const logout = async () => {
    await AuthService.logout();
    setState({ user: null, token: null, activeTab: 'dashboard', loading: false });
  };

  const setActiveTab = (tab: AppTab) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  return (
    <AppContext.Provider value={{ state, login, logout, setActiveTab }}>
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