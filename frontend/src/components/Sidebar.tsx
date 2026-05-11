import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppTab } from '../types';
import { AuthService } from '../services/authService';

const Sidebar: React.FC = () => {
  const { state, setActiveTab, logout: appLogout } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    0: true, 1: true, 2: false, 3: false, 4: false
  });

  const toggleSection = (idx: number) => {
    setOpenSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleLogout = async () => {
    try { await AuthService.logout(); appLogout(); }
    catch (error) { console.error("Erro ao sair:", error); }
  };

  const sections: {
    label: string;
    icon: string;
    items: { tab: AppTab; icon: string; label: string; desc: string; roles?: string[]; color?: string }[];
  }[] = [
    {
      label: 'SISTEMA MASTER', icon: 'fa-crown',
      items: [
        { tab: 'dashboard', icon: 'fa-border-all',    label: 'Painel Master',      desc: 'Visao geral de todas as empresas',  roles: ['SUPERADMIN'], color: 'text-blue-400'    },
        { tab: 'admin',     icon: 'fa-server',        label: 'Gestao de Empresas', desc: 'Criar e gerenciar tenants',         roles: ['SUPERADMIN'], color: 'text-blue-400'    },
        { tab: 'audit',     icon: 'fa-layer-group',   label: 'Atividades Master',  desc: 'Log global de todas as acoes',      roles: ['SUPERADMIN'], color: 'text-emerald-400' },
      ]
    },
    {
      label: 'GESTAO', icon: 'fa-chart-column',
      items: [
        { tab: 'unit',          icon: 'fa-border-all',        label: 'Dashboard',      desc: 'Resumo operacional da sua empresa'                                                    },
        { tab: 'users',         icon: 'fa-users-gear',        label: 'Colaboradores',  desc: 'Gerenciar colaboradores e permissoes',  roles: ['SUPERADMIN', 'gestor', 'admin']      },
        { tab: 'reports',       icon: 'fa-chart-column',      label: 'Relatorios',     desc: 'Metricas de treinamento e engajamento'                                                 },
        { tab: 'audit',         icon: 'fa-clock-rotate-left', label: 'Auditoria',      desc: 'Historico de acessos e alteracoes',    roles: ['SUPERADMIN', 'gestor']               },
        { tab: 'security',      icon: 'fa-lock',              label: 'Seguranca',      desc: 'Senhas, bloqueios e politicas',        roles: ['SUPERADMIN', 'gestor']               },
        { tab: 'configuracoes', icon: 'fa-sliders',           label: 'Configuracoes',  desc: 'Chave de IA e preferencias do cartorio', roles: ['SUPERADMIN', 'TENANT_ADMIN', 'gestor', 'admin'], color: 'text-blue-400' },
      ]
    },
    {
      label: 'CONTEUDO', icon: 'fa-layer-group',
      items: [
        { tab: 'trails',      icon: 'fa-road',       label: 'Trilhas',     desc: 'Trilhas de aprendizagem por perfil', color: 'text-teal-400'  },
        { tab: 'repositorio', icon: 'fa-photo-film', label: 'Repositorio', desc: 'Videos, audios e PDFs',             color: 'text-sky-400'   },
      ]
    },
    {
      label: 'CAPACITACAO', icon: 'fa-graduation-cap',
      items: [
        { tab: 'training',      icon: 'fa-graduation-cap', label: 'Treinamento AI',    desc: 'Roteiros, quizzes e certificados com IA', color: 'text-emerald-400' },
        { tab: 'exames',        icon: 'fa-file-pen',       label: 'Exames',            desc: 'Avaliacoes com IA e Bloom',               color: 'text-sky-400'    },
        { tab: 'metas',         icon: 'fa-trophy',         label: 'Metas & Premiacao', desc: 'Rankings e desempate Bloom Alto',         color: 'text-amber-400'  },
        { tab: 'meu-progresso', icon: 'fa-chart-line',     label: 'Meu Progresso',     desc: 'Trilhas, quizzes e certificados pessoais', color: 'text-teal-400'  },
        { tab: 'certificado',   icon: 'fa-certificate',    label: 'Certificados',      desc: 'Emitir e baixar certificados PDF',         color: 'text-amber-400' },
      ]
    },
    {
      label: 'PLATAFORMA', icon: 'fa-gear',
      items: [
        { tab: 'backup',   icon: 'fa-database',      label: 'Backup',        desc: 'Exportar dados do cartorio',        color: 'text-[#c9a84c]', roles: ['SUPERADMIN','gestor','admin'] },
        { tab: 'support',  icon: 'fa-headset',       label: 'Suporte',       desc: 'Contatar a MJ Consultoria'          },
        { tab: 'tutorial', icon: 'fa-book-open',     label: 'Tutorial',      desc: 'Guia completo de uso da plataforma' },
        { tab: 'terms',    icon: 'fa-file-contract', label: 'Termos de Uso', desc: 'Politicas e conformidade'           },
        { tab: 'privacy',  icon: 'fa-shield-heart',  label: 'Privacidade',   desc: 'LGPD e dados pessoais'              },
      ]
    }
  ];

  return (
    <aside
      className={`bg-bg-base text-text-secondary flex flex-col h-screen sticky top-0 border-r border-border no-print transition-all duration-300 ${
        expanded ? 'w-72' : 'w-16'
      }`}
    >
      {/* Logo / Toggle */}
      <button
        type="button"
        className="p-3 flex items-center gap-3 border-b border-border cursor-pointer group w-full text-left"
        onClick={() => setExpanded(prev => !prev)}
        title={expanded ? 'Recolher menu' : 'Expandir menu'}
      >
        <div className="w-10 h-10 flex-shrink-0 bg-brand-blue rounded-xl flex items-center justify-center group-hover:brightness-110 transition-all">
          <i className={`fa-solid text-white transition-all duration-300 ${expanded ? 'fa-chevron-left text-sm' : 'fa-graduation-cap text-lg'}`}></i>
        </div>
        {expanded && (
          <div className="overflow-hidden">
            <h1 className="text-text-primary font-bold text-xl leading-tight whitespace-nowrap">
              MJ <span className="text-brand-gold">Consultoria</span>
            </h1>
            <span className="text-[10px] bg-brand-gold/15 text-brand-gold px-2 py-0.5 rounded font-black tracking-widest uppercase">
              Treinamento
            </span>
          </div>
        )}
      </button>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto custom-scrollbar pb-8">
        {sections.map((section, sIdx) => {
          const visibleItems = section.items.filter(item =>
            !item.roles || item.roles.includes(state.user?.role || '') || state.user?.role === 'SUPERADMIN'
          );
          if (visibleItems.length === 0) return null;

          const isOpen = openSections[sIdx];
          const hasActiveItem = visibleItems.some(item => state.activeTab === item.tab);

          /* Collapsed: only the section icon */
          if (!expanded) {
            return (
              <div key={section.label} className="relative group/section">
                <button
                  type="button"
                  title={section.label}
                  onClick={() => { setExpanded(true); setOpenSections(prev => ({ ...prev, [sIdx]: true })); }}
                  className={`w-full flex items-center justify-center p-2 rounded-xl transition-all ${
                    hasActiveItem
                      ? 'bg-brand-blue/15 text-brand-blue'
                      : 'hover:bg-bg-surface text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    hasActiveItem ? 'bg-brand-blue/20' : 'bg-bg-surface'
                  }`}>
                    <i className={`fa-solid ${section.icon} text-sm ${
                      hasActiveItem ? 'text-brand-blue' : 'text-text-muted'
                    }`}></i>
                  </div>
                  {hasActiveItem && (
                    <span className="absolute right-1.5 top-1.5 w-1.5 h-1.5 rounded-full bg-brand-blue"></span>
                  )}
                </button>
              </div>
            );
          }

          /* Expanded: full dropdown */
          return (
            <div key={section.label}>
              <button
                type="button"
                onClick={() => toggleSection(sIdx)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all group ${
                  hasActiveItem && !isOpen ? 'bg-brand-blue/10' : 'hover:bg-bg-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${section.icon} text-[10px] ${
                    hasActiveItem ? 'text-brand-blue' : 'text-text-muted'
                  }`}></i>
                  <span className={`text-xs font-black tracking-[0.12em] uppercase ${
                    hasActiveItem && !isOpen ? 'text-brand-blue' : 'text-text-muted group-hover:text-text-secondary'
                  }`}>
                    {section.label}
                  </span>
                  {hasActiveItem && !isOpen && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-blue ml-1"></span>
                  )}
                </div>
                <i className={`fa-solid fa-chevron-down text-[9px] transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-text-secondary' : 'text-text-disabled'
                }`}></i>
              </button>

              {isOpen && (
                <div className="mt-0.5 ml-2 pl-2 border-l border-border space-y-0.5 mb-1">
                  {visibleItems.map((item) => {
                    const isActive = state.activeTab === item.tab;
                    return (
                      <button
                        key={`${item.tab}-${item.label}`}
                        type="button"
                        onClick={() => setActiveTab(item.tab)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all group ${
                          isActive
                            ? 'bg-brand-blue shadow-lg shadow-blue-900/30'
                            : 'hover:bg-bg-surface'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'bg-white/15' : 'bg-bg-surface group-hover:bg-bg-elevated'
                        }`}>
                          <i className={`fa-solid ${item.icon} text-[10px] ${
                            isActive ? 'text-white' : item.color ?? 'text-text-muted group-hover:text-brand-blue'
                          }`}></i>
                        </div>
                        <div className="text-left min-w-0">
                          <p className={`text-sm font-semibold truncate ${
                            isActive ? 'text-white' : 'text-text-secondary group-hover:text-text-primary'
                          }`}>
                            {item.label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: user info */}
      <div className="p-2 mt-auto border-t border-border">
        {expanded ? (
          <div className="bg-bg-surface p-3 rounded-2xl border border-border flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-bg-elevated flex items-center justify-center text-xs font-black text-text-secondary border border-border-strong flex-shrink-0">
              {state.user?.name ? state.user.name.substring(0, 2).toUpperCase() : '??'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-text-primary truncate">{state.user?.name || 'Usuario'}</p>
              <p className="text-[9px] text-brand-blue font-black uppercase tracking-widest truncate">
                {state.user?.role === 'SUPERADMIN' ? 'SUPER ADMIN' : state.user?.role || 'Acesso'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair do sistema"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all flex-shrink-0"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-sm"></i>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center text-xs font-black text-text-secondary border border-border">
              {state.user?.name ? state.user.name.substring(0, 2).toUpperCase() : '??'}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair do sistema"
              className="w-10 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-sm"></i>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
