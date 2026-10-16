
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useApp } from '../../context/AppContext';

interface Tenant {
  id: string;
  name: string;
  active: boolean;
  createdAt: any;
}

const DESTAQUES = [
  { icon: 'fa-graduation-cap', titulo: 'Trilhas de capacitação', desc: 'Conteúdo em vídeo, áudio, texto e infográfico organizado por perfil e setor, com quiz e prova liberada só após concluir os módulos.' },
  { icon: 'fa-certificate', titulo: 'Certificado verificável', desc: 'Emissão automática ao passar na prova, com código de integridade e página pública de validação — pronto para auditoria.' },
  { icon: 'fa-shield-halved', titulo: 'Conformidade e LGPD', desc: 'Conteúdo e relatórios alinhados à LGPD e, para cartórios, aos Provimentos nº 149/2023, 161/2024 e 213/2026, com dossiê exportável.' },
  { icon: 'fa-user-secret', titulo: 'Simulação de phishing', desc: 'Campanhas de conscientização e teste de segurança da informação, com métricas por colaborador.' },
  { icon: 'fa-chart-line', titulo: 'Relatórios e auditoria', desc: 'Desempenho, aprovações, erros por assunto e setor e trilha de auditoria para fiscalização e gestão interna.' },
  { icon: 'fa-building-shield', titulo: 'Ambiente isolado por cliente', desc: 'Cartórios e empresas privadas em ambientes separados — cada cliente só vê os próprios dados.' },
];

const BENEFICIOS = [
  'Reduz o risco de não conformidade: a evidência de treinamento fica pronta para qualquer fiscalização.',
  'Elimina o controle de certificados, presença e capacitação em planilha.',
  'Dá visão executiva em tempo real para sócios e gestores, sem depender de relatórios manuais.',
  'Atende cartórios e empresas privadas de qualquer setor, sem adaptação.',
];

const ATALHOS = [
  { tab: 'admin', icon: 'fa-server', titulo: 'Gestão de Empresas', desc: 'Clientes, recursos e demonstrações' },
  { tab: 'treinamentos-oficiais', icon: 'fa-wand-magic-sparkles', titulo: 'Treinamentos Oficiais', desc: 'Publicar conteúdo pronto' },
  { tab: 'reports-master', icon: 'fa-chart-column', titulo: 'Relatório por Empresa', desc: 'Números de cada cliente' },
  { tab: 'audit', icon: 'fa-layer-group', titulo: 'Atividades Master', desc: 'Registro global de ações' },
] as const;

const DashboardMasterView: React.FC = () => {
  const { state, setActiveTenant, setActiveTab } = useApp();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const isSuperAdmin = state.user?.role === 'SUPERADMIN';

  useEffect(() => {
    const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      setLoading(false);
    });
  }, []);

  const tenantsOrdenados = [...tenants].sort((a, b) => a.name.localeCompare(b.name));
  const primeiroNome = String(state.user?.name || '').split(' ')[0];

  const acessarCliente = () => {
    const t = tenants.find(x => x.id === clienteSelecionado);
    if (!t) return;
    setActiveTenant(t.id, t.name);
    setActiveTab('unit');
  };

  return (
    <div className="min-h-screen bg-slate-50 animate-in fade-in">
      <div className="max-w-[1240px] mx-auto px-6 md:px-10 py-8 md:py-10 space-y-8">

        {/* Cabeçalho */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#B08D3A]">Integra-Academy · MJ Consultoria</p>
            <h2 className="text-3xl md:text-4xl font-black text-navy tracking-tight mt-1">Painel Master</h2>
            <p className="text-base text-slate-500 mt-1">
              {primeiroNome ? `Olá, ${primeiroNome}. ` : ''}Acesse os clientes e as ferramentas de administração da plataforma.
            </p>
          </div>
        </header>

        {/* Acesso a cliente + atalhos */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Combobox em vez de listar os clientes na tela — não expõe nome de empresa nenhuma
              sem necessidade (ex.: durante uma demonstração). */}
          <section className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <i className="fa-solid fa-arrow-right-to-bracket text-lg"></i>
              </span>
              <h3 className="text-xl font-black text-navy">Acessar um cliente</h3>
            </div>
            <p className="text-[15px] text-slate-500 mb-6">Entre direto no ambiente de um cliente para ver a plataforma como ele vê.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="sr-only" htmlFor="cliente-master">Cliente</label>
              <select
                id="cliente-master"
                value={clienteSelecionado}
                onChange={e => setClienteSelecionado(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-base text-navy font-semibold outline-none focus:border-blue-500 focus:bg-white transition-colors"
              >
                <option value="">{loading ? 'Carregando clientes...' : 'Selecione um cliente...'}</option>
                {tenantsOrdenados.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{!t.active ? ' (inativo)' : ''}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={acessarCliente}
                disabled={!clienteSelecionado}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-4 rounded-2xl text-base shadow-sm transition-all flex items-center justify-center gap-2"
              >
                Acessar<i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </section>

          {isSuperAdmin && (
            <section className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
              <h3 className="text-xl font-black text-navy mb-4">Administração</h3>
              <div className="grid gap-2">
                {ATALHOS.map(a => (
                  <button key={a.tab} type="button" onClick={() => setActiveTab(a.tab)}
                    className="w-full flex items-center gap-4 text-left px-4 py-3 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all group">
                    <span className="w-10 h-10 rounded-xl bg-navy text-[#C9A84C] flex items-center justify-center flex-shrink-0">
                      <i className={`fa-solid ${a.icon}`}></i>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-bold text-navy">{a.titulo}</span>
                      <span className="block text-sm text-slate-500">{a.desc}</span>
                    </span>
                    <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-navy transition-colors"></i>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Apresentação da plataforma — pode ser mostrada a prospects: nenhum dado de cliente aqui. */}
        <section className="bg-navy rounded-3xl p-8 md:p-12 shadow-sm relative overflow-hidden">
          <i className="fa-solid fa-graduation-cap absolute -right-6 -top-6 text-[180px] text-white/5 pointer-events-none"></i>
          <div className="relative max-w-3xl">
            <p className="text-[#C9A84C] text-sm font-bold tracking-wide">Integra-Academy</p>
            <h3 className="text-white text-2xl md:text-4xl font-black tracking-tight mt-2 leading-tight">
              Capacitação e conformidade em um só lugar
            </h3>
            <p className="text-slate-300 text-lg leading-relaxed mt-4">
              Plataforma da MJ Consultoria para treinamento, certificação e conformidade, usada por cartórios e
              empresas privadas de diversos setores.
            </p>
            <p className="text-slate-300 text-lg leading-relaxed mt-4">
              <span className="text-white font-semibold">Objetivo:</span> profissionalizar a capacitação das equipes
              e comprovar, com evidência auditável, a conformidade regulatória, de segurança da informação e de
              proteção de dados — sem controle manual em planilha.
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-2xl font-black text-navy mb-5">O que a plataforma oferece</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {DESTAQUES.map(d => (
              <div key={d.titulo} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <span className="w-12 h-12 rounded-2xl bg-[#F5EDD8] text-[#9a7a2c] flex items-center justify-center mb-4">
                  <i className={`fa-solid ${d.icon} text-xl`}></i>
                </span>
                <p className="text-lg font-bold text-navy mb-2">{d.titulo}</p>
                <p className="text-[15px] text-slate-600 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-3xl p-7 md:p-8 shadow-sm">
          <h3 className="text-2xl font-black text-navy mb-5">Benefícios para o cliente</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {BENEFICIOS.map(b => (
              <li key={b} className="flex items-start gap-3">
                <i className="fa-solid fa-circle-check text-emerald-500 text-lg mt-0.5 flex-shrink-0"></i>
                <span className="text-base text-slate-700 leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default DashboardMasterView;
