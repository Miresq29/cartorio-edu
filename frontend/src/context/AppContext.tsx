
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, AppTab } from '../types';
import { AuthService } from '../services/authService';
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { GeminiService } from '../services/geminiService';

interface AppState {
  user: User | null;
  token: string | null;
  activeTab: AppTab;
  loading: boolean;
  tenantGeminiConfigured: boolean;
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
    tenantGeminiConfigured: false,
  });

  const tenantUnsubRef = useRef<(() => void) | null>(null);

  // Monitora o estado de autenticação em tempo real
  useEffect(() => {
    const unsubAuth = AuthService.onAuthUpdate((user, token) => {
      setState(prev => ({ ...prev, user, token, loading: false }));

      // Cancela listener anterior ao trocar de usuário
      if (tenantUnsubRef.current) {
        tenantUnsubRef.current();
        tenantUnsubRef.current = null;
      }

      if (user?.tenantId) {
        const ref = doc(db, 'tenants', user.tenantId);
        tenantUnsubRef.current = onSnapshot(ref, snap => {
          const key: string | null = snap.exists() ? (snap.data()?.geminiApiKey || null) : null;
          GeminiService.configure(key);
          setState(prev => ({ ...prev, tenantGeminiConfigured: !!key }));
        });
      } else {
        GeminiService.configure(null);
        setState(prev => ({ ...prev, tenantGeminiConfigured: false }));
      }
    });

    return () => {
      unsubAuth();
      if (tenantUnsubRef.current) tenantUnsubRef.current();
    };
  }, []);

  const login = (user: User, token: string) => {
    setState(prev => ({ ...prev, user, token }));
  };

  const logout = async () => {
    await AuthService.logout();
    GeminiService.configure(null);
    if (tenantUnsubRef.current) { tenantUnsubRef.current(); tenantUnsubRef.current = null; }
    setState({ user: null, token: null, activeTab: 'dashboard', loading: false, tenantGeminiConfigured: false });
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