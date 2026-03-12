import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

interface AuditLog {
  id: string;
  tipo: string;
  usuario: string;
  descricao: string;
  metadata?: Record<string, any>;
  createdAt: any;
}

interface Participant {
  id: string;
  nomeColaborador: string;
  treinamento: string;
  dataConclusao: string;
  status: string;
}

interface QuizResult {
  id: string;
  colaborador: string;
  treinamento: string;
  nota: number;
  aprovado: boolean;
  createdAt: any;
}

type Tab = 'colaboradores' | 'documentos' | 'treinamentos';

const RelatoriosView: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('colaboradores');
  const [filterPeriodo, setFilterPeriodo] = useState('30');

  useEffect(() => {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'));
    const u = onSnapshot(q, s => setAuditLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog))));
    return () => u();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'treinamentosParticipantes'), orderBy('createdAt', 'desc'));
    const u = onSnapshot(q, s => setParticipants(s.docs.map(d => ({ id: d.id, ...d.data() } as Participant))));
    return () => u();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'treinamentosQuizResults'), orderBy('createdAt', 'desc'));
    const u = onSnapshot(q, s => setQuizResults(s.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult))));
    return () => u();
  }, []);

  const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const limite = diasAtras(parseInt(filterPeriodo));

  const logsNoPeriodo = auditLogs.filter(l => {
    const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
    return d >= limite;
  });

  // ---- RELATÓRIO: USO POR COLABORADOR ----
  const usoPorColaborador = () => {
    const mapa: Record<string, { acessos: number; documentos: number; chats: number; ultimoAcesso: Date | null }> = {};
    logsNoPeriodo.forEach(l => {
      if (!l.usuario) return;
      if (!mapa[l.usuario]) mapa[l.usuario] = { acessos: 0, documentos: 0, chats: 0, ultimoAcesso: null };
      const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
      if (!mapa[l.usuario].ultimoAcesso || d > mapa[l.usuario].ultimoAcesso!) mapa[l.usuario].ultimoAcesso = d;
      if (['login', 'logout', 'acesso'].includes(l.tipo)) mapa[l.usuario].acessos++;
      if (['documento_inserido', 'documento_excluido'].includes(l.tipo)) mapa[l.usuario].documentos++;
      if (l.tipo === 'chat') mapa[l.usuario].chats++;
    });
    return Object.entries(mapa).sort((a, b) => b[1].acessos - a[1].acessos);
  };

  // ---- RELATÓRIO: DOCUMENTOS MAIS CONSULTADOS ----
  const documentosMaisConsultados = () => {
    const mapa: Record<string, { acessos: number; inserido?: string; excluido?: string; tipo: string }> = {};
    logsNoPeriodo.forEach(l => {
      const doc = l.metadata?.documento || l.metadata?.fileName || l.metadata?.titulo;
      if (!doc) return;
      if (!mapa[doc]) mapa[doc] = { acessos: 0, tipo: l.metadata?.tipo || 'documento' };
      mapa[doc].acessos++;
      if (l.tipo === 'documento_inserido') mapa[doc].inserido = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString('pt-BR') : '-';
      if (l.tipo === 'documento_excluido') mapa[doc].excluido = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString('pt-BR') : '-';
    });

    // Adiciona documentos da base sem logs
    const docsComLogs = Object.keys(mapa);
    if (docsComLogs.length === 0) {
      return [];
    }
    return Object.entries(mapa).sort((a, b) => b[1].acessos - a[1].acessos);
  };

  // ---- RELATÓRIO: TREINAMENTOS POR PERÍODO ----
  const treinamentosPorPeriodo = () => {
    const mapa: Record<string, { total: number; concluidos: number; quizAprovados: number; quizTotal: number; mediaNotas: number[] }> = {};
    participants.forEach(p => {
      const data = p.dataConclusao ? new Date(p.dataConclusao + 'T00:00:00') : null;
      if (data && data < limite) return;
      if (!mapa[p.treinamento]) mapa[p.treinamento] = { total: 0, concluidos: 0, quizAprovados: 0, quizTotal: 0, mediaNotas: [] };
      mapa[p.treinamento].total++;
      if (p.status === 'concluído') mapa[p.treinamento].concluidos++;
    });
    quizResults.forEach(r => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (d < limite) return;
      if (!mapa[r.treinamento]) mapa[r.treinamento] = { total: 0, concluidos: 0, quizAprovados: 0, quizTotal: 0, mediaNotas: [] };
      mapa[r.treinamento].quizTotal++;
      if (r.aprovado) mapa[r.treinamento].quizAprovados++;
      mapa[r.treinamento].mediaNotas.push(r.nota);
    });
    return Object.entries(mapa).sort((a, b) => b[1].total - a[1].total);
  };

  // Exportar CSV genérico
  const exportCSV = (headers: string[], rows: string[][], filename: string) => {
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = (title: string, headers: string[], rows: string[][]) => {
    const w = window.open('', '_blank'); if (!w) return;
    const tableRows = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;padding:40px;font-size:11px}
      .header{text-align:center;margin-bottom:24px;border-bottom:3px solid #1e3a8a;padding-bottom:16px}
      h1{font-size:20px;color:#1e3a8a;text-transform:uppercase;letter-spacing:2px}
      p{color:#6b7280;font-size:10px;margin-top:4px;letter-spacing:2px;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{background:#1e3a8a;color:white;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px}
      td{padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:10px}tr:nth-child(even) td{background:#f9fafb}
      .footer{margin-top:20px;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:10px}
      </style></head><body>
      <div class="header"><h1>MJ Consultoria</h1><p>${title}</p></div>
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
      <div class="footer">Gerado em ${new Date().toLocaleDateString('pt-BR')} · Período: últimos ${filterPeriodo} dias</div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
      </body></html>`);
    w.document.close();
  };

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'colaboradores', icon: 'fa-user-chart',    label: 'Uso por Colaborador'    },
    { id: 'documentos',    icon: 'fa-file-magnifying-glass', label: 'Documentos Consultados' },
    { id: 'treinamentos',  icon: 'fa-graduation-cap', label: 'Treinamentos por Período' },
  ];

  const colaboradores = usoPorColaborador();
  const documentos = documentosMaisConsultados();
  const treinamentos = treinamentosPorPeriodo();

  const maxAcessos = Math.max(1, ...colaboradores.map(([, v]) => v.acessos));
  const maxDocAcessos = Math.max(1, ...documentos.map(([, v]) => v.acessos));

  return (
    <div className="p-8 space-y-6 bg-[#05080f] min-h-screen animate-in fade-in">

      <header>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Relatórios de <span className="text-blue-500">Uso</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">MJ Consultoria // Análise de Utilização da Plataforma</p>
      </header>

      {/* Stats gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Eventos no Período', value: logsNoPeriodo.length,  icon: 'fa-chart-line',   color: 'blue'    },
          { label: 'Colaboradores',      value: colaboradores.length,  icon: 'fa-users',        color: 'emerald' },
          { label: 'Docs Movimentados',  value: logsNoPeriodo.filter(l => l.tipo.startsWith('documento')).length, icon: 'fa-file-lines', color: 'amber' },
          { label: 'Treinamentos',       value: treinamentos.length,   icon: 'fa-graduation-cap', color: 'purple' },
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
        <div className="flex border-b border-slate-800 overflow-x-auto">
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

          {/* Filtro período + exportar */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Período:</span>
              {['7', '15', '30', '90'].map(d => (
                <button key={d} onClick={() => setFilterPeriodo(d)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    filterPeriodo === d ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500 hover:text-white border border-slate-800'
                  }`}>
                  {d === '7' ? '7 dias' : d === '15' ? '15 dias' : d === '30' ? '30 dias' : '90 dias'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                if (activeTab === 'colaboradores') exportCSV(
                  ['Colaborador', 'Acessos', 'Documentos', 'Chats', 'Último Acesso'],
                  colaboradores.map(([n, v]) => [n, String(v.acessos), String(v.documentos), String(v.chats), v.ultimoAcesso?.toLocaleDateString('pt-BR') || '-']),
                  `uso_colaboradores_${new Date().toISOString().split('T')[0]}.csv`
                );
                if (activeTab === 'documentos') exportCSV(
                  ['Documento', 'Acessos', 'Status'],
                  documentos.map(([n, v]) => [n, String(v.acessos), v.excluido ? 'Excluído' : 'Ativo']),
                  `documentos_consultados_${new Date().toISOString().split('T')[0]}.csv`
                );
                if (activeTab === 'treinamentos') exportCSV(
                  ['Treinamento', 'Participantes', 'Concluídos', 'Quiz Aprovados', 'Média Nota'],
                  treinamentos.map(([n, v]) => [n, String(v.total), String(v.concluidos), `${v.quizAprovados}/${v.quizTotal}`, v.mediaNotas.length ? `${Math.round(v.mediaNotas.reduce((a,b)=>a+b,0)/v.mediaNotas.length)}%` : '-']),
                  `treinamentos_${new Date().toISOString().split('T')[0]}.csv`
                );
              }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
                <i className="fa-solid fa-file-csv"></i>CSV
              </button>
              <button onClick={() => {
                if (activeTab === 'colaboradores') exportPDF(
                  'Relatório de Uso por Colaborador',
                  ['Colaborador', 'Acessos', 'Documentos', 'Chats', 'Último Acesso'],
                  colaboradores.map(([n, v]) => [n, String(v.acessos), String(v.documentos), String(v.chats), v.ultimoAcesso?.toLocaleDateString('pt-BR') || '-'])
                );
                if (activeTab === 'documentos') exportPDF(
                  'Relatório de Documentos Consultados',
                  ['Documento', 'Acessos', 'Status'],
                  documentos.map(([n, v]) => [n, String(v.acessos), v.excluido ? 'Excluído' : 'Ativo'])
                );
                if (activeTab === 'treinamentos') exportPDF(
                  'Relatório de Treinamentos por Período',
                  ['Treinamento', 'Participantes', 'Concluídos', 'Quiz Aprovados', 'Média Nota'],
                  treinamentos.map(([n, v]) => [n, String(v.total), String(v.concluidos), `${v.quizAprovados}/${v.quizTotal}`, v.mediaNotas.length ? `${Math.round(v.mediaNotas.reduce((a,b)=>a+b,0)/v.mediaNotas.length)}%` : '-'])
                );
              }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white transition-all">
                <i className="fa-solid fa-file-pdf"></i>PDF
              </button>
            </div>
          </div>

          {/* ABA: Uso por Colaborador */}
          {activeTab === 'colaboradores' && (
            <div className="space-y-3">
              {colaboradores.length === 0 ? (
                <div className="bg-[#05080f] border border-slate-800 rounded-2xl p-10 text-center">
                  <i className="fa-solid fa-user-chart text-4xl text-slate-700 mb-3 block"></i>
                  <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Sem dados de acesso no período</p>
                  <p className="text-slate-700 text-xs mt-1">Os logs são registrados automaticamente conforme os colaboradores usam a plataforma</p>
                </div>
              ) : colaboradores.map(([nome, dados]) => (
                <div key={nome} className="bg-[#05080f] border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-black text-blue-400">{nome.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-white font-black text-sm">{nome}</p>
                        {dados.ultimoAcesso && (
                          <p className="text-[9px] text-slate-500">Último acesso: {dados.ultimoAcesso.toLocaleDateString('pt-BR')} {dados.ultimoAcesso.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div>
                        <p className="text-xl font-black text-white">{dados.acessos}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">Acessos</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-amber-400">{dados.documentos}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">Docs</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-blue-400">{dados.chats}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">Chats</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(dados.acessos / maxAcessos) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ABA: Documentos */}
          {activeTab === 'documentos' && (
            <div className="space-y-3">
              {documentos.length === 0 ? (
                <div className="bg-[#05080f] border border-slate-800 rounded-2xl p-10 text-center">
                  <i className="fa-solid fa-file-magnifying-glass text-4xl text-slate-700 mb-3 block"></i>
                  <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Sem movimentação de documentos no período</p>
                </div>
              ) : documentos.map(([nome, dados], i) => (
                <div key={nome} className="bg-[#05080f] border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-slate-600">#{i + 1}</span>
                      <div>
                        <p className="text-white font-black text-sm">{nome}</p>
                        <div className="flex gap-3 mt-0.5">
                          {dados.inserido && <span className="text-[9px] text-emerald-400">Inserido: {dados.inserido}</span>}
                          {dados.excluido && <span className="text-[9px] text-red-400">Excluído: {dados.excluido}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{dados.acessos}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest">Ações</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(dados.acessos / maxDocAcessos) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ABA: Treinamentos */}
          {activeTab === 'treinamentos' && (
            <div className="space-y-3">
              {treinamentos.length === 0 ? (
                <div className="bg-[#05080f] border border-slate-800 rounded-2xl p-10 text-center">
                  <i className="fa-solid fa-graduation-cap text-4xl text-slate-700 mb-3 block"></i>
                  <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Sem treinamentos no período</p>
                </div>
              ) : treinamentos.map(([nome, dados]) => {
                const taxaConclusao = dados.total > 0 ? Math.round((dados.concluidos / dados.total) * 100) : 0;
                const taxaAprov = dados.quizTotal > 0 ? Math.round((dados.quizAprovados / dados.quizTotal) * 100) : 0;
                const mediaNota = dados.mediaNotas.length > 0 ? Math.round(dados.mediaNotas.reduce((a, b) => a + b, 0) / dados.mediaNotas.length) : 0;
                return (
                  <div key={nome} className="bg-[#05080f] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-black text-sm">{nome}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{dados.total} participante(s) no período</p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg ${taxaConclusao >= 70 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${taxaConclusao >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {taxaConclusao}% conclusão
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-900 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-white">{dados.concluidos}/{dados.total}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Concluídos</p>
                      </div>
                      <div className="bg-slate-900 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-white">{dados.quizAprovados}/{dados.quizTotal}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Quiz Aprovados</p>
                      </div>
                      <div className="bg-slate-900 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-white">{mediaNota > 0 ? `${mediaNota}%` : '-'}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Média Notas</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span>Taxa de conclusão</span><span>{taxaConclusao}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${taxaConclusao >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${taxaConclusao}%` }}></div>
                      </div>
                      {dados.quizTotal > 0 && (
                        <>
                          <div className="flex justify-between text-[9px] text-slate-500 mt-2">
                            <span>Taxa de aprovação no quiz</span><span>{taxaAprov}%</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${taxaAprov >= 70 ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${taxaAprov}%` }}></div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RelatoriosView;