import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, where, limit } from 'firebase/firestore';

const DashboardView: React.FC = () => {
  const { state } = useApp();
  const [unitDocs, setUnitDocs] = useState<any[]>([]);
  const [unitLogs, setUnitLogs] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    if (!state.user?.tenantId) return;

    const q1 = query(collection(db, 'knowledgeBase'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q1, s => setUnitDocs(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const q2 = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(50));
    const u2 = onSnapshot(q2, s => setUnitLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const q3 = query(collection(db, 'checklists'), orderBy('createdAt', 'desc'));
    const u3 = onSnapshot(q3, s => setChecklists(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const q4 = query(collection(db, 'treinamentosParticipantes'), orderBy('createdAt', 'desc'));
    const u4 = onSnapshot(q4, s => setParticipants(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { u1(); u2(); u3(); u4(); };
  }, [state.user?.tenantId]);

  const formatDate = (ts: any) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR');
  };

  const formatTime = (ts: any) => {
    if (!ts) return '--:--';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const LOG_ICONS: Record<string, { icon: string; color: string }> = {
    login:              { icon: 'fa-right-to-bracket', color: 'emerald' },
    logout:             { icon: 'fa-right-from-bracket', color: 'slate'  },
    documento_inserido: { icon: 'fa-file-circle-plus',  color: 'blue'   },
    documento_excluido: { icon: 'fa-file-circle-xmark', color: 'red'    },
    usuario_criado:     { icon: 'fa-user-plus',          color: 'purple' },
    usuario_alterado:   { icon: 'fa-user-pen',           color: 'amber'  },
    permissao_alterada: { icon: 'fa-shield-halved',      color: 'orange' },
  };

  const concluidos = participants.filter(p => p.status === 'concluído').length;

  return (
    <div className="p-10 space-y-10 bg-[#05080f] min-h-screen animate-in fade-in">

      <header className="flex justify-between items-end">
        <div>
          <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em] mb-2">
            Gestão de Unidade // {state.user?.tenantId || 'MJ CONSULTORIA'}
          </p>
          <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
            Painel de <span className="text-blue-500">Conformidade</span>
          </h2>
        </div>
        <div className="text-right">
          <span className="text-slate-500 text-[10px] font-bold uppercase italic">
            Atualizado: {new Date().toLocaleDateString('pt-BR')}
          </span>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Documentos na Base', value: unitDocs.length,   icon: 'fa-file-lines',    color: 'blue',    border: 'border-l-blue-600'    },
          { label: 'Protocolos Ativos',  value: checklists.length, icon: 'fa-clipboard-check', color: 'emerald', border: 'border-l-emerald-600' },
          { label: 'Treinamentos',       value: concluidos,        icon: 'fa-graduation-cap', color: 'amber',   border: 'border-l-amber-600'   },
          { label: 'Ações Registradas',  value: unitLogs.length,   icon: 'fa-scroll',        color: 'purple',  border: 'border-l-purple-600'  },
        ].map((k, i) => (
          <div key={i} className={`bg-[#0a111f] border border-slate-800 ${k.border} border-l-4 p-8 rounded-[40px] shadow-xl hover:border-slate-700 transition-all`}>
            <i className={`fa-solid ${k.icon} text-${k.color}-500 text-xl mb-3 block`}></i>
            <p className="text-5xl font-black text-white tracking-tighter">{k.value}</p>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* Documentos Recentes */}
        <div className="bg-[#0a111f] border border-slate-800 rounded-[40px] p-8">
          <h3 className="text-white font-bold italic uppercase text-sm mb-6 flex items-center gap-2">
            <i className="fa-solid fa-file-lines text-blue-500"></i> Acervo da Serventia
          </h3>
          <div className="space-y-2">
            {unitDocs.slice(0, 6).map((doc: any) => (
              <div key={doc.id} className="p-4 bg-[#05080f] border border-slate-800/50 rounded-2xl flex justify-between items-center hover:border-blue-500/30 transition-all group">
                <div className="flex items-center gap-3 min-w-0">
                  <i className="fa-solid fa-file-pdf text-red-400 text-xs flex-shrink-0"></i>
                  <span className="text-slate-300 text-xs font-bold truncate">{doc.fileName || doc.title}</span>
                </div>
                <span className="text-[9px] text-slate-600 font-black uppercase flex-shrink-0 ml-3">{formatDate(doc.createdAt)}</span>
              </div>
            ))}
            {unitDocs.length === 0 && (
              <div className="text-center py-8 opacity-40">
                <i className="fa-solid fa-inbox text-3xl text-slate-600 mb-2 block"></i>
                <p className="text-slate-600 text-[10px] italic">Nenhum documento cadastrado ainda.</p>
              </div>
            )}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="bg-[#0a111f] border border-slate-800 rounded-[40px] p-8">
          <h3 className="text-white font-bold italic uppercase text-sm mb-6 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-emerald-500"></i> Atividade Recente
          </h3>
          <div className="space-y-3">
            {unitLogs.slice(0, 7).map((log: any) => {
              const cfg = LOG_ICONS[log.tipo] || { icon: 'fa-circle', color: 'slate' };
              return (
                <div key={log.id} className="flex gap-3 items-start pb-3 border-b border-slate-800/50 last:border-0">
                  <div className={`w-7 h-7 rounded-lg bg-${cfg.color}-500/10 border border-${cfg.color}-500/20 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <i className={`fa-solid ${cfg.icon} text-${cfg.color}-400 text-xs`}></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-300 font-medium leading-tight">{log.descricao || log.details}</p>
                    <p className="text-[9px] text-slate-600 uppercase font-black tracking-tighter mt-1">
                      {log.usuario || log.userName} · {formatTime(log.createdAt || log.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
            {unitLogs.length === 0 && (
              <div className="text-center py-8 opacity-40">
                <i className="fa-solid fa-scroll text-3xl text-slate-600 mb-2 block"></i>
                <p className="text-slate-600 text-[10px] italic">Aguardando logs de auditoria...</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Protocolos Ativos */}
      {checklists.length > 0 && (
        <div className="bg-[#0a111f] border border-slate-800 rounded-[40px] p-8">
          <h3 className="text-white font-bold italic uppercase text-sm mb-6 flex items-center gap-2">
            <i className="fa-solid fa-clipboard-check text-emerald-500"></i> Protocolos Ativos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {checklists.slice(0, 6).map((c: any) => (
              <div key={c.id} className="p-4 bg-[#05080f] border border-slate-800/50 rounded-2xl hover:border-emerald-500/30 transition-all">
                <p className="text-white font-black text-sm">{c.title}</p>
                <p className="text-[9px] text-slate-500 mt-1">
                  <i className="fa-solid fa-list-check text-blue-500 mr-1.5"></i>
                  {c.items?.length || 0} itens mapeados
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardView;