import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, limit
} from 'firebase/firestore';
import { useApp } from '../../context/AppContext';

interface AuditLog {
  id: string;
  tipo: 'login' | 'logout' | 'documento_inserido' | 'documento_excluido' | 'usuario_criado' | 'usuario_alterado' | 'permissao_alterada' | 'acesso';
  descricao: string;
  usuario: string;
  usuarioId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
  createdAt: any;
}

type FilterTipo = 'todos' | 'acesso' | 'documentos' | 'usuarios';
type Tab = 'logs' | 'documentos' | 'usuarios';

const TIPO_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  login:              { icon: 'fa-right-to-bracket', color: 'emerald', label: 'Login'               },
  logout:             { icon: 'fa-right-from-bracket', color: 'slate',  label: 'Logout'              },
  documento_inserido: { icon: 'fa-file-circle-plus',  color: 'blue',   label: 'Doc. Inserido'       },
  documento_excluido: { icon: 'fa-file-circle-xmark', color: 'red',    label: 'Doc. Excluído'       },
  usuario_criado:     { icon: 'fa-user-plus',          color: 'purple', label: 'Usuário Criado'      },
  usuario_alterado:   { icon: 'fa-user-pen',           color: 'amber',  label: 'Usuário Alterado'    },
  permissao_alterada: { icon: 'fa-shield-halved',      color: 'orange', label: 'Permissão Alterada'  },
  acesso:             { icon: 'fa-eye',                color: 'blue',   label: 'Acesso'              },
};

const AuditoriaView: React.FC = () => {
  const { state } = useApp();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('logs');
  const [filterTipo, setFilterTipo] = useState<FilterTipo>('todos');
  const [filterUsuario, setFilterUsuario] = useState('');
  const [filterData, setFilterData] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(500));
    const unsub = onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog))));
    return () => unsub();
  }, []);

  const formatDate = (ts: any) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Filtros
  const filteredLogs = logs.filter(l => {
    if (filterTipo === 'acesso' && !['login', 'logout', 'acesso'].includes(l.tipo)) return false;
    if (filterTipo === 'documentos' && !['documento_inserido', 'documento_excluido'].includes(l.tipo)) return false;
    if (filterTipo === 'usuarios' && !['usuario_criado', 'usuario_alterado', 'permissao_alterada'].includes(l.tipo)) return false;
    if (filterUsuario && !l.usuario?.toLowerCase().includes(filterUsuario.toLowerCase())) return false;
    if (filterData) {
      const logDate = l.createdAt?.toDate ? l.createdAt.toDate().toISOString().split('T')[0] : '';
      if (!logDate.startsWith(filterData)) return false;
    }
    return true;
  });

  // Stats
  const hoje = new Date().toISOString().split('T')[0];
  const logsHoje = logs.filter(l => {
    const d = l.createdAt?.toDate ? l.createdAt.toDate().toISOString().split('T')[0] : '';
    return d === hoje;
  });
  const docsInseridos = logs.filter(l => l.tipo === 'documento_inserido').length;
  const docsExcluidos = logs.filter(l => l.tipo === 'documento_excluido').length;
  const usuariosUnicos = [...new Set(logs.map(l => l.usuario).filter(Boolean))].length;

  // Exportar CSV
  const exportCSV = () => {
    const headers = ['Data/Hora', 'Tipo', 'Usuário', 'Descrição', 'Tenant'];
    const rows = filteredLogs.map(l => [
      formatDate(l.createdAt),
      TIPO_CONFIG[l.tipo]?.label || l.tipo,
      l.usuario || '-',
      l.descricao || '-',
      l.tenantId || '-',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `auditoria_${hoje}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Exportar PDF
  const exportPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = filteredLogs.slice(0, 200).map(l => {
      const cfg = TIPO_CONFIG[l.tipo] || { color: 'slate', label: l.tipo };
      return `<tr>
        <td>${formatDate(l.createdAt)}</td>
        <td><span style="color:#60a5fa;font-weight:bold">${cfg.label}</span></td>
        <td>${l.usuario || '-'}</td>
        <td>${l.descricao || '-'}</td>
      </tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Log de Auditoria</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;padding:40px;font-size:11px}
      .header{text-align:center;margin-bottom:24px;border-bottom:3px solid #1e3a8a;padding-bottom:16px}
      .header h1{font-size:20px;color:#1e3a8a;text-transform:uppercase;letter-spacing:2px}
      .header p{color:#6b7280;font-size:10px;margin-top:4px;letter-spacing:2px;text-transform:uppercase}
      table{width:100%;border-collapse:collapse}
      th{background:#1e3a8a;color:white;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px}
      td{padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:10px}
      tr:nth-child(even) td{background:#f9fafb}
      .footer{margin-top:20px;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:10px}
      </style></head><body>
      <div class="header"><h1>MJ Consultoria</h1><p>Log de Auditoria da Plataforma</p></div>
      <table><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Usuário</th><th>Descrição</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="footer">Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${filteredLogs.length} registros</div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
      </body></html>`);
    w.document.close();
  };

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'logs',       icon: 'fa-list-ul',          label: 'Todos os Logs'   },
    { id: 'documentos', icon: 'fa-file-lines',        label: 'Documentos'      },
    { id: 'usuarios',   icon: 'fa-users-gear',        label: 'Usuários/Acesso' },
  ];

  const renderContent = () => {
    let displayLogs = filteredLogs;
    if (activeTab === 'documentos') displayLogs = logs.filter(l => ['documento_inserido', 'documento_excluido'].includes(l.tipo));
    if (activeTab === 'usuarios')   displayLogs = logs.filter(l => ['login', 'logout', 'usuario_criado', 'usuario_alterado', 'permissao_alterada'].includes(l.tipo));

    if (displayLogs.length === 0) {
      return (
        <div className="bg-[#05080f] border border-slate-800 rounded-2xl p-10 text-center">
          <i className="fa-solid fa-scroll text-4xl text-slate-700 mb-3 block"></i>
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Nenhum registro encontrado</p>
          <p className="text-slate-700 text-xs mt-1">Os logs são gerados automaticamente pelas ações na plataforma</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {displayLogs.map(log => {
          const cfg = TIPO_CONFIG[log.tipo] || { icon: 'fa-circle', color: 'slate', label: log.tipo };
          return (
            <div key={log.id} className="bg-[#05080f] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex items-start gap-4 transition-all">
              <div className={`w-9 h-9 rounded-xl bg-${cfg.color}-500/10 border border-${cfg.color}-500/20 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <i className={`fa-solid ${cfg.icon} text-${cfg.color}-400 text-sm`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] font-black uppercase tracking-widest text-${cfg.color}-400 bg-${cfg.color}-500/10 px-2 py-0.5 rounded-md`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-white font-bold">{log.usuario || 'Sistema'}</span>
                  {log.tenantId && <span className="text-[9px] text-slate-600">{log.tenantId}</span>}
                </div>
                <p className="text-xs text-slate-400 mt-1">{log.descricao}</p>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="flex gap-3 mt-1 flex-wrap">
                    {Object.entries(log.metadata).slice(0, 3).map(([k, v]) => (
                      <span key={k} className="text-[9px] text-slate-600">{k}: <span className="text-slate-500">{String(v)}</span></span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[9px] text-slate-600 flex-shrink-0 mt-1">{formatDate(log.createdAt)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-8 space-y-6 bg-[#05080f] min-h-screen animate-in fade-in">

      <header>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Log de <span className="text-blue-500">Auditoria</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">MJ Consultoria // Rastreabilidade Completa</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Eventos Hoje',     value: logsHoje.length,  icon: 'fa-clock',            color: 'blue'    },
          { label: 'Total de Logs',    value: logs.length,      icon: 'fa-scroll',           color: 'slate'   },
          { label: 'Docs Movimentados', value: docsInseridos + docsExcluidos, icon: 'fa-file-lines', color: 'amber' },
          { label: 'Usuários Ativos',  value: usuariosUnicos,   icon: 'fa-users',            color: 'emerald' },
        ].map((s, i) => (
          <div key={i} className="bg-[#0a111f] border border-slate-800 rounded-[24px] p-6 space-y-3">
            <i className={`fa-solid ${s.icon} text-${s.color}-500 text-xl`}></i>
            <p className="text-3xl font-black text-white">{s.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#0a111f] border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/50'
              }`}>
              <i className={`fa-solid ${tab.icon} text-xs`}></i>{tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">

          {/* Filtros + Exportar */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <input value={filterUsuario} onChange={e => setFilterUsuario(e.target.value)}
                placeholder="Buscar usuário..."
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500 min-w-[160px]" />
              {activeTab === 'logs' && (
                <select value={filterTipo} onChange={e => setFilterTipo(e.target.value as FilterTipo)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500">
                  <option value="todos">Todos os Tipos</option>
                  <option value="acesso">Acesso (Login/Logout)</option>
                  <option value="documentos">Documentos</option>
                  <option value="usuarios">Usuários/Permissões</option>
                </select>
              )}
              <input type="date" value={filterData} onChange={e => setFilterData(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
                <i className="fa-solid fa-file-csv"></i>CSV
              </button>
              <button onClick={exportPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white transition-all">
                <i className="fa-solid fa-file-pdf"></i>PDF
              </button>
            </div>
          </div>

          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
            {activeTab === 'logs' ? filteredLogs.length : activeTab === 'documentos'
              ? logs.filter(l => ['documento_inserido', 'documento_excluido'].includes(l.tipo)).length
              : logs.filter(l => ['login', 'logout', 'usuario_criado', 'usuario_alterado', 'permissao_alterada'].includes(l.tipo)).length
            } registros
          </p>

          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AuditoriaView;