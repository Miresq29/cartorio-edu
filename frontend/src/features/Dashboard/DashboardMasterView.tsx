
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
  { icon: 'fa-graduation-cap', titulo: 'Trilhas de capacitação', desc: 'Conteúdo em vídeo, áudio e texto organizado por perfil, com quiz e liberação de prova só após assistir até o fim.' },
  { icon: 'fa-certificate', titulo: 'Certificado verificável', desc: 'Emissão automática ao passar na prova, com hash de integridade e página pública de validação — pronto para auditoria.' },
  { icon: 'fa-shield-halved', titulo: 'Conformidade CNJ', desc: 'Conteúdo e relatórios alinhados aos Provimentos nº 149/2023, 161/2024 e 213/2026, com dossiê de conformidade exportável.' },
  { icon: 'fa-user-secret', titulo: 'Simulação de phishing', desc: 'Campanhas de conscientização e teste de segurança da informação, com métricas por colaborador.' },
  { icon: 'fa-chart-line', titulo: 'Relatórios e auditoria', desc: 'Visão completa de desempenho, aprovações e trilha de auditoria para fiscalização e gestão interna.' },
  { icon: 'fa-building-shield', titulo: 'Multiempresa', desc: 'Um ambiente isolado por cliente — cartórios e empresas privadas, cada um só vê seus próprios dados.' },
];

const DashboardMasterView: React.FC = () => {
  const { setActiveTenant, setActiveTab } = useApp();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clienteSelecionado, setClienteSelecionado] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      setLoading(false);
    });
  }, []);

  // Contagens ao vivo — refletem a realidade dos cartorios em tempo real,
  // em vez de uma foto tirada uma unica vez ao montar a tela.
  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => setTotalUsers(snap.size));
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'knowledgeBase'), snap => setTotalDocs(snap.size));
  }, []);

  const ativos = tenants.filter(t => t.active).length;
  const tenantsOrdenados = [...tenants].sort((a, b) => a.name.localeCompare(b.name));

  const acessarCliente = () => {
    const t = tenants.find(x => x.id === clienteSelecionado);
    if (!t) return;
    setActiveTenant(t.id, t.name);
    setActiveTab('unit');
  };

  return (
    <div className="p-10 space-y-10 bg-slate-50 min-h-screen animate-in fade-in">
      <header>
        <h2 className="text-4xl font-black text-navy italic uppercase tracking-tighter">
          Console <span className="text-blue-500">Master</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
          MJ Consultoria // Gestão Global de Instâncias
        </p>
      </header>

      {/* KPIs Consolidados — números agregados, sem expor nomes de clientes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl hover:border-blue-500/30 transition-all group">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-500">Clientes Ativos</p>
          <p className="text-5xl font-black text-navy mt-2 tracking-tighter">
            {loading ? <span className="animate-pulse text-slate-300">—</span> : ativos}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl hover:border-emerald-500/30 transition-all group">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-emerald-500">Documentos Totais</p>
          <p className="text-5xl font-black text-navy mt-2 tracking-tighter">{totalDocs}</p>
        </div>
        <div className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl hover:border-purple-500/30 transition-all group">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-purple-500">Usuários na Plataforma</p>
          <p className="text-5xl font-black text-navy mt-2 tracking-tighter">{totalUsers}</p>
        </div>
      </div>

      {/* Acesso direto a um cliente — combobox em vez de listar todos os clientes na tela,
          pra nao expor nome/ID de empresa nenhuma sem necessidade (ex: durante uma demo). */}
      <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-2xl">
        <h3 className="text-navy font-bold italic uppercase text-sm mb-1 flex items-center gap-2">
          <i className="fa-solid fa-arrow-right-to-bracket text-blue-500"></i> Acessar um Cliente
        </h3>
        <p className="text-slate-400 text-xs mb-6">Entre direto no ambiente de um cliente, sem passar pela Gestão de Empresas.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={clienteSelecionado}
            onChange={e => setClienteSelecionado(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-navy font-bold outline-none focus:border-blue-500"
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
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black px-8 py-4 rounded-2xl uppercase text-[11px] tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-arrow-right-to-bracket"></i>Acessar
          </button>
        </div>
      </div>

      {/* Apresentação comercial — tela profissional pra mostrar a prospects/clientes,
          sem nenhum dado de outra empresa visível. */}
      <div className="bg-navy rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <i className="fa-solid fa-graduation-cap text-9xl text-gold"></i>
        </div>
        <div className="relative z-10">
          <p className="text-gold text-[10px] font-black uppercase tracking-[0.4em] mb-2">Integra-Academy</p>
          <h3 className="text-white text-2xl font-black italic uppercase tracking-tighter mb-2">
            Capacitação e conformidade em um só lugar
          </h3>
          <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
            Plataforma da MJ Consultoria para treinamento, certificação e conformidade notarial —
            usada hoje por cartórios e empresas em todo o Brasil.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {DESTAQUES.map(d => (
            <div key={d.titulo} className="bg-white/5 border border-white/10 rounded-3xl p-5">
              <i className={`fa-solid ${d.icon} text-gold text-lg mb-3`}></i>
              <p className="text-white font-bold text-xs uppercase tracking-wide mb-1">{d.titulo}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardMasterView;
