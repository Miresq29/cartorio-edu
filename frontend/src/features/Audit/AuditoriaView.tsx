// frontend/src/features/Audit/AuditoriaView.tsx
// Auditoria completa — logs reais, filtros funcionais, exportação CSV

import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, limit, where
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type LogTipo =
  | 'login' | 'logout'
  | 'quiz_realizado' | 'quiz_aprovado' | 'quiz_reprovado'
  | 'trilha_concluida' | 'certificado_emitido'
  | 'usuario_criado' | 'usuario_alterado' | 'usuario_removido'
  | 'permissao_alterada'
  | 'documento_inserido' | 'documento_excluido'
  | 'acesso';

interface AuditLog {
  id: string;
  tipo: LogTipo;
  descricao: string;
  usuario: string;
  usuarioId?: string;
  tenantId?: string;
  ip?: string;
  metadata?: Record<string, any>;
  createdAt: any;
}

// ─── Config visual por tipo ───────────────────────────────────────────────────

const TIPO_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string; grupo: string }> = {
  login:              { icon: 'fa-right-to-bracket', color: '#059669', bg: '#d1fae5', label: 'Login',               grupo: 'acesso'     },
  logout:             { icon: 'fa-right-from-bracket',color: '#64748b', bg: '#f1f5f9', label: 'Logout',              grupo: 'acesso'     },
  quiz_realizado:     { icon: 'fa-clipboard-check',   color: '#4F46E5', bg: '#eef2ff', label: 'Quiz Realizado',      grupo: 'treinamento'},
  quiz_aprovado:      { icon: 'fa-circle-check',      color: '#059669', bg: '#d1fae5', label: 'Quiz Aprovado',       grupo: 'treinamento'},
  quiz_reprovado:     { icon: 'fa-circle-xmark',      color: '#DC2626', bg: '#fee2e2', label: 'Quiz Reprovado',      grupo: 'treinamento'},
  trilha_concluida:   { icon: 'fa-flag-checkered',    color: '#7C3AED', bg: '#ede9fe', label: 'Trilha Concluída',    grupo: 'treinamento'},
  certificado_emitido:{ icon: 'fa-certificate',       color: '#D97706', bg: '#fef3c7', label: 'Certificado Emitido', grupo: 'treinamento'},
  usuario_criado:     { icon: 'fa-user-plus',          color: '#4F46E5', bg: '#eef2ff', label: 'Usuário Criado',     grupo: 'usuarios'   },
  usuario_alterado:   { icon: 'fa-user-pen',           color: '#D97706', bg: '#fef3c7', label: 'Usuário Alterado',   grupo: 'usuarios'   },
  usuario_removido:   { icon: 'fa-user-minus',         color: '#DC2626', bg: '#fee2e2', label: 'Usuário Removido',   grupo: 'usuarios'   },
  permissao_alterada: { icon: 'fa-shield-halved',      color: '#0891B2', bg: '#e0f2fe', label: 'Permissão Alterada', grupo: 'usuarios'   },
  documento_inserido: { icon: 'fa-file-circle-plus',   color: '#059669', bg: '#d1fae5', label: 'Doc. Inserido',      grupo: 'documentos' },
  documento_excluido: { icon: 'fa-file-circle-xmark',  color: '#DC2626', bg: '#fee2e2', label: 'Doc. Excluído',      grupo: 'documentos' },
  acesso:             { icon: 'fa-eye',                color: '#4F46E5', bg: '#eef2ff', label: 'Acesso',             grupo: 'acesso'     },
};

const GRUPOS = [
  { id: 'todos',      label: 'Todos'       },
  { id: 'acesso',     label: 'Acessos'     },
  { id: 'treinamento',label: 'Treinamento' },
  { id: 'usuarios',   label: 'Usuários'    },
  { id: 'documentos', label: 'Documentos'  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: any): string {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Hook público para gravar log — exportar para usar em outros módulos
export async function registrarLog(
  tipo: LogTipo,
  descricao: string,
  usuario: string,
  tenantId: string,
  extra?: Record<string, any>
) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      tipo, descricao, usuario, tenantId,
      metadata: extra || {},
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('Erro ao registrar log:', e);
  }
}

// ─── Main View ────────────────────────────────────────────────────────────────

const AuditoriaView: React.FC = () => {
  const { state } = useApp();
  const user = state.user!;
  const tenantId = user.tenantId;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 50;

  useEffect(() => {
    const q = query(
      collection(db, 'auditLogs'),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  // Filtros
  const logsFiltrados = logs.filter(log => {
    if (grupo !== 'todos') {
      const cfg = TIPO_CONFIG[log.tipo];
      if (!cfg || cfg.grupo !== grupo) return false;
    }
    if (busca) {
      const b = busca.toLowerCase();
      if (!log.usuario?.toLowerCase().includes(b) &&
          !log.descricao?.toLowerCase().includes(b)) return false;
    }
    if (dataInicio) {
      const d = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt || 0);
      if (d < new Date(dataInicio)) return false;
    }
    if (dataFim) {
      const d = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt || 0);
      if (d > new Date(dataFim + 'T23:59:59')) return false;
    }
    return true;
  });

  const totalPaginas = Math.ceil(logsFiltrados.length / POR_PAGINA);
  const logsPagina = logsFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // Stats
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const logsHoje = logs.filter(l => {
    const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt || 0);
    return d >= hoje;
  });
  const usuarios = [...new Set(logs.map(l => l.usuario).filter(Boolean))];

  const exportCSV = () => {
    const rows = ['Data,Usuário,Tipo,Descrição'];
    logsFiltrados.forEach(l => {
      rows.push([
        formatDate(l.createdAt),
        l.usuario || '',
        TIPO_CONFIG[l.tipo]?.label || l.tipo,
        `"${(l.descricao || '').replace(/"/g, '""')}"`,
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#0D1B3E]">Trilha de Auditoria</h2>
            <p className="text-sm text-slate-500 mt-0.5">Registro completo de acessos e ações na plataforma</p>
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#A8863C] text-[#0A1628] px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
            <i className="fa-solid fa-download text-xs"></i>Exportar Excel
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total de Logs',     value: logs.length,                                                    icon: 'fa-list-check',    color: '#4F46E5' },
            { label: 'Hoje',              value: logsHoje.length,                                                icon: 'fa-calendar-day',  color: '#059669' },
            { label: 'Usuários Ativos',   value: usuarios.length,                                                icon: 'fa-users',         color: '#D97706' },
            { label: 'Filtro Atual',      value: logsFiltrados.length,                                           icon: 'fa-filter',        color: '#7C3AED' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-[14px] p-5 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.color + '15' }}>
                <i className={`fa-solid ${s.icon}`} style={{ color: s.color }}></i>
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
              <p className="text-3xl font-black text-[#0A1628]">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Card principal */}
        <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm overflow-hidden">

          {/* Filtros */}
          <div className="p-5 border-b border-slate-100 space-y-4">
            {/* Grupos */}
            <div className="flex gap-2 flex-wrap">
              {GRUPOS.map(g => (
                <button key={g.id} onClick={() => { setGrupo(g.id); setPagina(1); }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    grupo === g.id
                      ? 'bg-[#C9A84C] text-[#0A1628]'
                      : 'bg-white text-slate-500 hover:bg-slate-200'
                  }`}>{g.label}</button>
              ))}
            </div>

            {/* Busca e datas */}
            <div className="flex flex-wrap gap-3 items-center">
              <input value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }}
                placeholder="Buscar por usuário ou descrição..."
                className="bg-[#0D1B3E] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#C9A84C] w-64" />
              <div className="flex items-center gap-2">
                <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPagina(1); }}
                  className="bg-[#0D1B3E] border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#C9A84C]" />
                <span className="text-slate-500 text-sm">até</span>
                <input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPagina(1); }}
                  className="bg-[#0D1B3E] border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#C9A84C]" />
              </div>
              {(busca || dataInicio || dataFim || grupo !== 'todos') && (
                <button onClick={() => { setBusca(''); setDataInicio(''); setDataFim(''); setGrupo('todos'); setPagina(1); }}
                  className="text-xs text-slate-500 hover:text-red-500 transition-all">
                  <i className="fa-solid fa-xmark mr-1"></i>Limpar filtros
                </button>
              )}
              <span className="ml-auto text-xs text-slate-500 font-bold">
                {logsFiltrados.length} registro{logsFiltrados.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-[#C9A84C]/50 border-t-indigo-600 rounded-full animate-spin"></div>
              <span className="text-sm">Carregando logs...</span>
            </div>
          ) : logsPagina.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <i className="fa-solid fa-list-check text-4xl mb-3 opacity-30"></i>
              <p className="text-sm">Nenhum log encontrado com os filtros atuais</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#0D1B3E] border-b border-slate-200">
                    {['Data/Hora', 'Usuário', 'Tipo', 'Descrição', 'Detalhes'].map(h => (
                      <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logsPagina.map(log => {
                    const cfg = TIPO_CONFIG[log.tipo] || { icon: 'fa-circle', color: '#94a3b8', bg: '#f1f5f9', label: log.tipo, grupo: 'outros' };
                    return (
                      <tr key={log.id} className="border-b border-slate-100 hover:bg-[#0D1B3E] transition-all">
                        <td className="p-3 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="p-3 font-bold text-slate-700 whitespace-nowrap">
                          {log.usuario || '–'}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            <i className={`fa-solid ${cfg.icon} text-[9px]`}></i>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs">
                          {log.descricao || '–'}
                        </td>
                        <td className="p-3 text-slate-500 text-[10px] max-w-[200px]">
                          {log.metadata && Object.keys(log.metadata).length > 0 ? (
                            <div className="space-y-0.5">
                              {Object.entries(log.metadata).slice(0, 3).map(([k, v]) => (
                                <p key={k}><span className="text-slate-500 font-bold">{k}:</span> {String(v)}</p>
                              ))}
                            </div>
                          ) : '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Página {pagina} de {totalPaginas} · {logsFiltrados.length} registros
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                  className="px-3 py-1.5 rounded-lg bg-white text-slate-600 text-xs font-bold disabled:opacity-40 hover:bg-slate-200 transition-all">
                  ← Anterior
                </button>
                {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                  const p = Math.max(1, pagina - 2) + i;
                  if (p > totalPaginas) return null;
                  return (
                    <button key={p} onClick={() => setPagina(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        p === pagina ? 'bg-[#C9A84C] text-[#0A1628]' : 'bg-white text-slate-600 hover:bg-slate-200'
                      }`}>{p}</button>
                  );
                })}
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                  className="px-3 py-1.5 rounded-lg bg-white text-slate-600 text-xs font-bold disabled:opacity-40 hover:bg-slate-200 transition-all">
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nota CNJ */}
        <div className="bg-blue-50 border border-blue-200 rounded-[14px] p-4 flex items-start gap-3">
          <i className="fa-solid fa-circle-info text-blue-500 text-base mt-0.5 flex-shrink-0"></i>
          <p className="text-xs text-blue-700 leading-relaxed">
            <strong>Trilha de Auditoria CNJ</strong> — Os registros desta tela compõem a trilha de auditoria exigida pelo
            Provimento CNJ nº 213/2026 (art. 14, §2º) e Provimento nº 161/2023. Os logs são gravados automaticamente
            a cada ação relevante na plataforma e não podem ser alterados pelos usuários.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuditoriaView;
