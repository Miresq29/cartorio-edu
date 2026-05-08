import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';

const LoginView          = lazy(() => import('./features/Auth/LoginView'));
const ChangePasswordView = lazy(() => import('./features/Auth/ChangePasswordView'));
const DashboardView      = lazy(() => import('./features/Dashboard/DashboardView'));
const DashboardMasterView= lazy(() => import('./features/Dashboard/DashboardMasterView'));
const ChatView           = lazy(() => import('./features/RAG/ChatView'));
const KnowledgeBase      = lazy(() => import('./features/Base/KnowledgeBase'));
const ComplianceReviewer = lazy(() => import('./features/Compliance/ComplianceReviewer'));
const ExpertReviewView   = lazy(() => import('./features/Expert/ExpertReviewView'));
const ChecklistView      = lazy(() => import('./features/Checklists/ChecklistView'));
const SecurityView       = lazy(() => import('./features/Security/SecurityView'));
const UsersView          = lazy(() => import('./features/Users/UsersView'));
const AuditoriaView      = lazy(() => import('./features/Audit/AuditoriaView'));
const RelatoriosView     = lazy(() => import('./features/Reports/RelatoriosView'));
const SupportView        = lazy(() => import('./features/Support/SupportView'));
const TrainingView       = lazy(() => import('./features/Training/TrainingView'));
const IAAnaliticaView    = lazy(() => import('./features/Analytics/IAAnaliticaView'));
const TermsView          = lazy(() => import('./features/Terms/TermsView'));
const PrivacyView        = lazy(() => import('./features/Privacy/PrivacyView'));
const PolicyView         = lazy(() => import('./features/Policy/PolicyView'));
const TutorialView       = lazy(() => import('./features/Tutorial/TutorialView'));
const TrailsView         = lazy(() => import('./features/Trails/TrailsView'));
const CampanhasView      = lazy(() => import('./features/Campanhas/CampanhasView'));
const VideosView         = lazy(() => import('./features/Videos/VideosView'));
const ComunicadosView    = lazy(() => import('./features/Comunicados/ComunicadosView'));
const BannersView        = lazy(() => import('./features/Banners/BannersView'));
const MeuProgressoView   = lazy(() => import('./features/Progresso/MeuProgressoView'));
const ExamesView         = lazy(() => import('./features/Exames/ExamesView'));
const MetasView          = lazy(() => import('./features/Metas/MetasView'));
const RepositorioView    = lazy(() => import('./features/Repositorio/RepositorioView'));
const CertificadoView   = lazy(() => import('./features/Certificado/CertificadoView'));
const BackupView        = lazy(() => import('./features/Backup/BackupView'));

// 🛡️ Admin Views
const TenantsView          = lazy(() => import('./features/Admin/TenantsView'));
const MasterActivitiesView = lazy(() => import('./features/Admin/MasterActivitiesView'));

const MainLayout: React.FC = () => {
  const { state } = useApp();

  if (!state || !state.user) {
    return (
      <Suspense fallback={<div className="bg-[#F5EDD8] h-screen" />}>
        <LoginView />
      </Suspense>
    );
  }

  if (state.user.isFirstLogin) {
    return (
      <Suspense fallback={<div className="bg-[#F5EDD8] h-screen" />}>
        <ChangePasswordView />
      </Suspense>
    );
  }

  const renderContent = () => {
    switch (state.activeTab) {
      case 'dashboard':  return <DashboardMasterView />;
      case 'unit':       return <DashboardView />;
      case 'chat':       return <ChatView />;
      case 'compliance': return <ComplianceReviewer />;
      case 'checklists': return <ChecklistView />;
      case 'knowledge':  return <KnowledgeBase />;
      case 'security':   return <SecurityView />;
      case 'users':      return <UsersView />;
      case 'training':   return <TrainingView />;
      case 'trails':     return <TrailsView />;
      case 'admin':      return <TenantsView />;
      case 'audit':      return <AuditoriaView />;
      case 'reports':    return <RelatoriosView />;
      case 'support':    return <SupportView />;
      case 'analytics':  return <IAAnaliticaView />;
      case 'terms':      return <TermsView />;
      case 'privacy':    return <PrivacyView />;
      case 'policy':     return <PolicyView />;
      case 'tutorial':   return <TutorialView />;
      case 'campanhas':     return <CampanhasView />;
      case 'videos':        return <RepositorioView />;
      case 'comunicados':   return <ComunicadosView />;
      case 'banners':       return <BannersView />;
      case 'meu-progresso': return <MeuProgressoView />;
      case 'exames':        return <ExamesView />;
      case 'metas':         return <MetasView />;
      case 'repositorio':   return <RepositorioView />;
      case 'certificado':   return <CertificadoView />;
      case 'backup':        return <BackupView />;
      default:
        return state.user?.role === 'SUPERADMIN' ? <DashboardMasterView /> : <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5EDD8] text-[#0A1628]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <header className="px-6 py-3 border-b border-[#E8D5A3] flex justify-between items-center bg-white sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <h2 className="text-[10px] font-black text-[#8A9BB0] uppercase tracking-[0.3em]">
              Ambiente: {state.user.tenantId || 'MJ Consultoria'}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-[#2C3E5A] uppercase italic tracking-tighter">
              {String(state.user.name || 'Operador')}
            </p>
          </div>
        </header>

        <Suspense fallback={<div className="p-10 text-[#5A6E8A] font-bold italic text-center">Iniciando Protocolos MJ...</div>}>
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </Suspense>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <ToastProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ToastProvider>
  </ErrorBoundary>
);

export default App;