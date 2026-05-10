import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

interface Participant {
  id: string;
  nomeColaborador: string;
  cargo: string;
  treinamento: string;
  dataConclusao: string;
  status: 'concluído' | 'pendente' | 'vencido';
  observacao?: string;
}

interface QuizResult {
  id: string;
  quizTitulo: string;
  treinamento: string;
  colaborador: string;
  cargo: string;
  nota: number;
  total: number;
  aprovado: boolean;
  createdAt?: any;
}

const TrainingReport: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [filterColaborador, setFilterColaborador] = useState('');
  const [filterTreinamento, setFilterTreinamento] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'treinamentosParticipantes'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant))));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'treinamentosQuizResults'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setQuizResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult))));
    return () => unsub();
  }, []);

  const treinamentosUnicos = [...new Set(participants.map(p => p.treinamento))];

  const filtered = participants.filter(p => {
    const matchNome = !filterColaborador || p.nomeColaborador.toLowerCase().includes(filterColaborador.toLowerCase());
    const matchTreinamento = filterTreinamento === 'todos' || p.treinamento === filterTreinamento;
    const matchStatus = filterStatus === 'todos' || p.status === filterStatus;
    return matchNome && matchTreinamento && matchStatus;
  });

  const getQuiz = (nome: string, treinamento: string) =>
    quizResults.find(r => r.colaborador === nome && r.treinamento === treinamento);

  // Stats
  const total = participants.length;
  const concluidos = participants.filter(p => p.status === 'concluído').length;
  const taxaAprovacao = quizResults.length > 0
    ? Math.round((quizResults.filter(r => r.aprovado).length / quizResults.length) * 100) : 0;
  const mediaNotas = quizResults.length > 0
    ? Math.round(quizResults.reduce((acc, r) => acc + r.nota, 0) / quizResults.length) : 0;

  // ---- EXPORTAR CSV ----
  const exportCSV = () => {
    const headers = ['Colaborador', 'Cargo', 'Treinamento', 'Data Conclusão', 'Status', 'Nota Prova', 'Aprovado na Prova'];
    const rows = filtered.map(p => {
      const quiz = getQuiz(p.nomeColaborador, p.treinamento);
      return [
        p.nomeColaborador,
        p.cargo || '',
        p.treinamento,
        new Date(p.dataConclusao + 'T00:00:00').toLocaleDateString('pt-BR'),
        p.status,
        quiz ? `${quiz.nota}%` : 'Sem avaliação',
        quiz ? (quiz.aprovado ? 'Sim' : 'Não') : '-',
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_treinamentos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ---- EXPORTAR PDF (via print) ----
  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = filtered.map(p => {
      const quiz = getQuiz(p.nomeColaborador, p.treinamento);
      const statusColor = p.status === 'concluído' ? '#10b981' : p.status === 'pendente' ? '#f59e0b' : '#ef4444';
      return `
        <tr>
          <td>${p.nomeColaborador}</td>
          <td>${p.cargo || '-'}</td>
          <td>${p.treinamento}</td>
          <td>${new Date(p.dataConclusao + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
          <td style="color:${statusColor};font-weight:bold">${p.status.toUpperCase()}</td>
          <td>${quiz ? `${quiz.nota}%` : '-'}</td>
          <td style="color:${quiz?.aprovado ? '#10b981' : quiz ? '#ef4444' : '#6b7280'};font-weight:bold">
            ${quiz ? (quiz.aprovado ? '✓ SIM' : '✗ NÃO') : '-'}
          </td>
        </tr>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Relatório de Treinamentos — MJ Consultoria</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111; padding: 40px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 32px; border-bottom: 3px solid #1e3a8a; padding-bottom: 16px; }
          .header h1 { font-size: 22px; color: #1e3a8a; letter-spacing: 2px; text-transform: uppercase; }
          .header p { color: #6b7280; font-size: 10px; margin-top: 4px; letter-spacing: 3px; text-transform: uppercase; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #1e3a8a; }
          .stat-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #1e3a8a; color: white; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
          td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
          tr:nth-child(even) td { background: #f9fafb; }
          .footer { margin-top: 32px; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MJ Consultoria</h1>
          <p>Relatório de Treinamentos — Gestão do Conhecimento</p>
        </div>
        <div class="stats">
          <div class="stat"><div class="stat-value">${total}</div><div class="stat-label">Total Registros</div></div>
          <div class="stat"><div class="stat-value">${concluidos}</div><div class="stat-label">Concluídos</div></div>
          <div class="stat"><div class="stat-value">${taxaAprovacao}%</div><div class="stat-label">Taxa Aprovação</div></div>
          <div class="stat"><div class="stat-value">${mediaNotas}%</div><div class="stat-label">Média nas Provas</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Colaborador</th><th>Cargo</th><th>Treinamento</th>
              <th>Data</th><th>Status</th><th>Nota</th><th>Aprovado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">
          Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} · MJ Consultoria · ${filtered.length} registros
        </div>
        <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ---- CERTIFICADO ----
  const printCertificate = (p: Participant) => {
    setSelectedParticipant(p);
    const quiz = getQuiz(p.nomeColaborador, p.treinamento);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Certificado — ${p.nomeColaborador}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Georgia, serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8fafc; }
          .cert { border: 8px double #1e3a8a; padding: 60px; text-align: center; max-width: 700px; background: white; }
          .org { font-size: 13px; letter-spacing: 5px; text-transform: uppercase; color: #1e3a8a; margin-bottom: 6px; font-family: Arial; }
          .subtitle { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #9ca3af; margin-bottom: 40px; font-family: Arial; }
          .cert-title { font-size: 15px; letter-spacing: 6px; text-transform: uppercase; color: #374151; margin-bottom: 24px; font-family: Arial; }
          .label { font-size: 11px; color: #9ca3af; margin-bottom: 12px; font-family: Arial; }
          .name { font-size: 32px; font-weight: bold; color: #111; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 6px; display: inline-block; min-width: 300px; }
          .role { font-size: 12px; color: #9ca3af; margin-bottom: 28px; font-family: Arial; }
          .training-label { font-size: 11px; color: #9ca3af; margin-bottom: 8px; font-family: Arial; }
          .training { font-size: 22px; font-weight: bold; color: #1e3a8a; margin-bottom: 8px; }
          .date { font-size: 11px; color: #9ca3af; margin-bottom: 32px; font-family: Arial; }
          .quiz-badge { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px 20px; display: inline-block; margin-bottom: 40px; font-family: Arial; font-size: 11px; color: #16a34a; }
          .signatures { display: flex; justify-content: space-around; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 28px; }
          .sig-line { border-top: 1px solid #374151; width: 180px; padding-top: 8px; font-size: 10px; color: #9ca3af; font-family: Arial; }
          .footer { font-size: 9px; color: #d1d5db; margin-top: 24px; font-family: Arial; }
          @media print { body { background: white; } }
        </style>
      </head>
      <body>
        <div class="cert">
          <div class="org">MJ Consultoria</div>
          <div class="subtitle">Gestão do Conhecimento Notarial</div>
          <div class="cert-title">Certificado de Conclusão</div>
          <div class="label">Certificamos que</div>
          <div class="name">${p.nomeColaborador}</div>
          ${p.cargo ? `<div class="role">${p.cargo}</div>` : '<div style="margin-bottom:28px"></div>'}
          <div class="training-label">concluiu com êxito o treinamento</div>
          <div class="training">${p.treinamento}</div>
          <div class="date">em ${new Date(p.dataConclusao + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          ${quiz ? `<div class="quiz-badge">Avaliação de conhecimento: <strong>${quiz.nota}%</strong> — ${quiz.aprovado ? '✓ Aprovado' : '✗ Reprovado'}</div>` : ''}
          <div class="signatures">
            <div class="sig-line">Responsável pelo Treinamento</div>
            <div class="sig-line">MJ Consultoria</div>
          </div>
          <div class="footer">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} · ID: ${p.id}</div>
        </div>
        <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Registros',   value: total,               icon: 'fa-users',        color: 'blue'    },
          { label: 'Concluídos',        value: concluidos,          icon: 'fa-circle-check',  color: 'emerald' },
          { label: 'Taxa de Aprovação', value: `${taxaAprovacao}%`, icon: 'fa-trophy',        color: 'amber'   },
          { label: 'Média nas Provas',  value: `${mediaNotas}%`,    icon: 'fa-chart-line',    color: 'purple'  },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <i className={`fa-solid ${stat.icon} text-${stat.color}-500 text-lg`}></i>
            <p className="text-2xl font-black text-[#0A1628]">{stat.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros + Exportar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <input value={filterColaborador} onChange={e => setFilterColaborador(e.target.value)}
            placeholder="Buscar colaborador..."
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-[#0A1628] outline-none focus:border-blue-500 min-w-[180px]" />
          <select value={filterTreinamento} onChange={e => setFilterTreinamento(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-[#0A1628] outline-none focus:border-blue-500">
            <option value="todos">Todos os Treinamentos</option>
            {treinamentosUnicos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-[#0A1628] outline-none focus:border-blue-500">
            <option value="todos">Todos os Status</option>
            <option value="concluído">Concluído</option>
            <option value="pendente">Pendente</option>
            <option value="vencido">Vencido</option>
          </select>
        </div>

        {/* Botões de exportação */}
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

      {/* Lista */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{filtered.length} registros encontrados</p>

        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <i className="fa-solid fa-file-chart-column text-4xl text-slate-700 mb-3 block"></i>
            <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Nenhum registro encontrado</p>
          </div>
        ) : (
          filtered.map(p => {
            const quiz = getQuiz(p.nomeColaborador, p.treinamento);
            const statusColor = p.status === 'concluído' ? 'emerald' : p.status === 'pendente' ? 'amber' : 'red';
            return (
              <div key={p.id} className="bg-white border border-slate-200 hover:border-slate-200 rounded-2xl p-4 flex items-center gap-4 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-[#0A1628]">{p.nomeColaborador.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-[#0A1628]">{p.nomeColaborador}</span>
                    {p.cargo && <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">{p.cargo}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-slate-500">
                      <i className="fa-solid fa-graduation-cap text-blue-500 mr-1.5"></i>{p.treinamento}
                    </span>
                    <span className="text-xs text-slate-500">
                      <i className="fa-solid fa-calendar mr-1.5"></i>
                      {new Date(p.dataConclusao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    {quiz && (
                      <span className={`text-xs font-bold ${quiz.aprovado ? 'text-emerald-400' : 'text-red-400'}`}>
                        <i className="fa-solid fa-clipboard-question mr-1"></i>
                        Prova: {quiz.nota}% — {quiz.aprovado ? 'Aprovado' : 'Reprovado'}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg bg-${statusColor}-500/10 border border-${statusColor}-500/20 flex-shrink-0`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest text-${statusColor}-400`}>{p.status}</span>
                </div>
                {p.status === 'concluído' && (
                  <button onClick={() => printCertificate(p)}
                    className="opacity-0 group-hover:opacity-100 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5">
                    <i className="fa-solid fa-certificate text-xs"></i>Certificado
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrainingReport;