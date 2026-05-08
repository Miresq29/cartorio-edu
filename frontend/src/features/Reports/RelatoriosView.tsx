// frontend/src/features/Reports/RelatoriosView.tsx
// Relatórios completos — KPIs, gráficos recharts, evidências exportáveis

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import * as XLSX from 'xlsx';
import {
  collection, query, orderBy, onSnapshot, where
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import * as XLSX from 'xlsx';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizResult {
  id: string;
  colaborador: string;
  userId?: string;
  nota: number;
  aprovado: boolean;
  trailTitle?: string;
  moduleTitle?: string;
  ia?: boolean;
  tenantId?: string;
  createdAt: any;
}

interface TrilhaProgresso {
  id: string;
  userId: string;
  userName: string;
  trilhaId: string;
  trilhaTitulo?: string;
  concluido: boolean;
  tenantId: string;
}

interface UserData {
  id: string;
  name: string;
  cargo?: string;
  role: string;
  tenantId: string;
}

interface Certificado {
  id: string;
  colaboradorNome: string;
  trilhaTitulo: string;
  notaFinal: number;
  emitidoEm: any;
  tenantId: string;
}

type Tab = 'visao_geral' | 'colaboradores' | 'trilhas' | 'evidencias';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(a: number, b: number) { return b === 0 ? 0 : Math.round((a / b) * 100); }

function formatDate(ts: any): string {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getMonth(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

const COLORS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string; value: string | number; sub?: string;
  icon: string; color: string; trend?: { value: number; label: string };
}> = ({ label, value, sub, icon, color, trend }) => (
  <div className="bg-white border border-[#E8D5A3] rounded-[14px] p-5 shadow-sm">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center`}
        style={{ background: color + '15' }}>
        <i className={`fa-solid ${icon} text-base`} style={{ color }}></i>
      </div>
      {trend && (
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${
          trend.value >= 0
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-red-50 text-red-500'
        }`}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </span>
      )}
    </div>
    <p className="text-[10px] font-black text-[#8A9BB0] uppercase tracking-widest mb-1">{label}</p>
    <p className="text-3xl font-black text-[#0A1628]">{value}</p>
    {sub && <p className="text-[11px] text-[#8A9BB0] mt-1">{sub}</p>}
  </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E8D5A3] rounded-xl p-3 shadow-lg text-xs">
      <p className="font-black text-[#1A2744] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.value}{p.name?.includes('%') || p.name === 'Média' ? '%' : ''}
        </p>
      ))}
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const RelatoriosView: React.FC = () => {
  const { state } = useApp();
  const user = state.user!;
  const tenantId = user.tenantId;
  const isSuperAdmin = user.role === 'SUPERADMIN';

  const [tab, setTab] = useState<Tab>('visao_geral');
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [progresso, setProgresso] = useState<TrilhaProgresso[]>([]);
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [periodo, setPeriodo] = useState('90');
  const [buscaColab, setBuscaColab] = useState('');

  useEffect(() => {
    const q1 = query(collection(db, 'treinamentosQuizResults'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q1, s => setQuizResults(s.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult))));

    const q2 = query(collection(db, 'trilhasProgresso'), where('tenantId', '==', tenantId));
    const u2 = onSnapshot(q2, s => setProgresso(s.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaProgresso))));

    const q3 = query(collection(db, 'users'));
    const u3 = onSnapshot(q3, s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as UserData))));

    const q4 = query(collection(db, 'certificados'), where('tenantId', '==', tenantId));
    const u4 = onSnapshot(q4, s => setCertificados(s.docs.map(d => ({ id: d.id, ...d.data() } as Certificado))));

    return () => { u1(); u2(); u3(); u4(); };
  }, [tenantId]);

  // Filtrar por período
  const periodoMs = Number(periodo) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - periodoMs;
  const filteredResults = quizResults.filter(r => {
    const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
    return d.getTime() >= cutoff;
  });

  // KPIs
  const colab = usuarios.filter(u => !['SUPERADMIN', 'gestor'].includes(u.role));
  const totalTestes = filteredResults.length;
  const totalAprovados = filteredResults.filter(r => r.aprovado).length;
  const taxaAprovacao = pct(totalAprovados, totalTestes);
  const mediaGeral = totalTestes
    ? Math.round(filteredResults.reduce((a, r) => a + r.nota, 0) / totalTestes)
    : 0;
  const totalCerts = certificados.length;

  // Gráfico 1: Aprovação por trilha
  const porTrilha = useMemo(() => {
    const map: Record<string, { total: number; aprovados: number; soma: number }> = {};
    filteredResults.forEach(r => {
      const t = r.trailTitle || 'Sem trilha';
      if (!map[t]) map[t] = { total: 0, aprovados: 0, soma: 0 };
      map[t].total++;
      if (r.aprovado) map[t].aprovados++;
      map[t].soma += r.nota;
    });
    return Object.entries(map)
      .map(([name, v]) => ({
        name: name.length > 18 ? name.slice(0, 16) + '…' : name,
        'Taxa (%)': pct(v.aprovados, v.total),
        'Média': Math.round(v.soma / v.total),
        testes: v.total,
      }))
      .sort((a, b) => b['Taxa (%)'] - a['Taxa (%)'])
      .slice(0, 8);
  }, [filteredResults]);

  // Gráfico 2: Atividade por mês
  const porMes = useMemo(() => {
    const map: Record<string, { testes: number; aprovados: number }> = {};
    filteredResults.forEach(r => {
      const m = getMonth(r.createdAt);
      if (!m) return;
      if (!map[m]) map[m] = { testes: 0, aprovados: 0 };
      map[m].testes++;
      if (r.aprovado) map[m].aprovados++;
    });
    return Object.entries(map)
      .slice(-6)
      .map(([mes, v]) => ({
        mes,
        Testes: v.testes,
        Aprovados: v.aprovados,
      }));
  }, [filteredResults]);

  // Gráfico 3: Distribuição de notas
  const distribuicaoNotas = useMemo(() => {
    const faixas = [
      { name: '0-49', min: 0, max: 49 },
      { name: '50-69', min: 50, max: 69 },
      { name: '70-84', min: 70, max: 84 },
      { name: '85-100', min: 85, max: 100 },
    ];
    return faixas.map(f => ({
      name: f.name,
      value: filteredResults.filter(r => r.nota >= f.min && r.nota <= f.max).length,
    }));
  }, [filteredResults]);

  // Por colaborador
  const porColab = useMemo(() => {
    return colab
      .filter(u => !buscaColab || u.name.toLowerCase().includes(buscaColab.toLowerCase()))
      .map(u => {
        const res = filteredResults.filter(r => r.userId === u.id || r.colaborador === u.name);
        const prog = progresso.filter(p => p.userId === u.id && p.concluido);
        const aprov = res.filter(r => r.aprovado).length;
        const media = res.length ? Math.round(res.reduce((a, r) => a + r.nota, 0) / res.length) : 0;
        const certs = certificados.filter(c => c.colaboradorNome === u.name).length;
        return {
          id: u.id, name: u.name, cargo: u.cargo || '',
          testes: res.length, aprovados: aprov,
          taxa: pct(aprov, res.length),
          media, trilhas: prog.length, certs,
          ultimo: res[0],
        };
      })
      .sort((a, b) => b.taxa - a.taxa);
  }, [colab, filteredResults, progresso, certificados, buscaColab]);

  // Exportar Excel
  const handlePrint = () => { window.print(); };

  const exportCSV = () => {
    const rows = ['Colaborador,Trilha,Módulo,Data,Nota,Status,Tipo'];
    filteredResults.forEach(r => {
      rows.push([
        r.colaborador, r.trailTitle || '', r.moduleTitle || '',
        formatDate(r.createdAt), r.nota + '%',
        r.aprovado ? 'Aprovado' : 'Reprovado',
        r.ia ? 'IA' : 'Padrão'
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidencias_treinamento_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ABAS: { id: Tab; label: string; icon: string }[] = [
    { id: 'visao_geral',   label: 'Visão Geral',    icon: 'fa-chart-pie'    },
    { id: 'colaboradores', label: 'Colaboradores',  icon: 'fa-users'        },
    { id: 'trilhas',       label: 'Por Trilha',     icon: 'fa-road'         },
    { id: 'evidencias',    label: 'Evidências',     icon: 'fa-file-lines'   },
  ];

  return (
    <div className="min-h-screen bg-[#FBF7EE]">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#0A1628]">Relatórios de Treinamento</h2>
            <p className="text-sm text-[#5A6E8A] mt-0.5">Desempenho · Evidências · Exportação</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="bg-white border border-[#E8D5A3] rounded-xl px-3 py-2 text-sm text-[#1A2744] outline-none focus:border-[#C9A84C] shadow-sm">
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
              <option value="99999">Todo o período</option>
            </select>
            <button onClick={handlePrint} className="flex items-center gap-2 bg-white border border-[#E8D5A3] hover:border-slate-400 text-[#2C3E5A] px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"><i className="fa-solid fa-print text-xs"></i>Imprimir</button><button onClick={exportCSV}
              className="flex items-center gap-2 bg-[#1A3A6B] hover:bg-[#132A55] text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
              <i className="fa-solid fa-file-excel text-xs"></i>Exportar Excel
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total de Testes"   value={totalTestes}      icon="fa-clipboard-check"  color="#4F46E5" sub={`no período selecionado`} />
          <StatCard label="Taxa de Aprovação" value={`${taxaAprovacao}%`} icon="fa-circle-check"  color="#059669" sub={`${totalAprovados} aprovações`} />
          <StatCard label="Média Geral"       value={`${mediaGeral}%`} icon="fa-chart-bar"        color="#D97706" sub="média das notas" />
          <StatCard label="Certificados"      value={totalCerts}       icon="fa-certificate"      color="#7C3AED" sub="emitidos no total" />
        </div>

        {/* Abas */}
        <div className="bg-white border border-[#E8D5A3] rounded-[16px] shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            {ABAS.map(a => (
              <button key={a.id} onClick={() => setTab(a.id)}
                className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                  tab === a.id
                    ? 'border-[#1A3A6B] text-[#1A3A6B] bg-[#FBF5E0]/50'
                    : 'border-transparent text-[#8A9BB0] hover:text-[#2C3E5A]'
                }`}>
                <i className={`fa-solid ${a.icon}`}></i>{a.label}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── VISÃO GERAL ─────────────────────────────────────────────── */}
            {tab === 'visao_geral' && (
              <div className="space-y-6">

                {/* Linha 1: Atividade mensal + Distribuição */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Atividade mensal */}
                  <div className="lg:col-span-2 space-y-3">
                    <p className="text-xs font-black text-[#5A6E8A] uppercase tracking-widest">Atividade Mensal</p>
                    {porMes.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-[#8A9BB0] text-sm">Sem dados no período</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={porMes} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="Testes"    stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Aprovados" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Distribuição de notas */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-[#5A6E8A] uppercase tracking-widest">Distribuição de Notas</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={distribuicaoNotas} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                          dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={false}>
                          {distribuicaoNotas.map((_, i) => (
                            <Cell key={i} fill={['#DC2626', '#D97706', '#059669', '#4F46E5'][i]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-1">
                      {distribuicaoNotas.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ background: ['#DC2626', '#D97706', '#059669', '#4F46E5'][i] }}></div>
                          <span className="text-[10px] text-[#5A6E8A]">{d.name}%: <strong className="text-[#1A2744]">{d.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Linha 2: Aprovação por trilha */}
                <div className="space-y-3">
                  <p className="text-xs font-black text-[#5A6E8A] uppercase tracking-widest">Taxa de Aprovação por Trilha</p>
                  {porTrilha.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-[#8A9BB0] text-sm">Sem dados no período</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={porTrilha} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-20} textAnchor="end" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Taxa (%)" radius={[4, 4, 0, 0]}>
                          {porTrilha.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                        <Bar dataKey="Média" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Resumo rápido */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Colaboradores ativos', value: colab.filter(u => filteredResults.some(r => r.userId === u.id || r.colaborador === u.name)).length },
                    { label: 'Testes com IA', value: filteredResults.filter(r => r.ia).length },
                    { label: 'Reprovações', value: filteredResults.filter(r => !r.aprovado).length },
                    { label: 'Trilhas ativas', value: new Set(progresso.map(p => p.trilhaId)).size },
                  ].map((s, i) => (
                    <div key={i} className="bg-[#FBF7EE] border border-[#E8D5A3] rounded-xl p-4 text-center">
                      <p className="text-2xl font-black text-[#1A2744]">{s.value}</p>
                      <p className="text-[10px] text-[#8A9BB0] font-black uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── COLABORADORES ────────────────────────────────────────────── */}
            {tab === 'colaboradores' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input value={buscaColab} onChange={e => setBuscaColab(e.target.value)}
                    placeholder="Buscar colaborador..."
                    className="bg-[#FBF7EE] border border-[#E8D5A3] rounded-xl px-4 py-2.5 text-sm text-[#1A2744] outline-none focus:border-[#C9A84C] w-64" />
                  <span className="text-xs text-[#8A9BB0] font-bold">{porColab.length} colaboradores</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#FBF7EE] border-b border-[#E8D5A3]">
                        {['Colaborador', 'Cargo', 'Testes', 'Aprovações', 'Taxa', 'Média', 'Trilhas', 'Certs', 'Último Teste'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-[#5A6E8A] uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porColab.length === 0 && (
                        <tr><td colSpan={9} className="text-center p-8 text-[#8A9BB0]">Nenhum dado encontrado.</td></tr>
                      )}
                      {porColab.map(c => (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-[#FBF7EE] transition-all">
                          <td className="p-3 font-bold text-[#0A1628]">{c.name}</td>
                          <td className="p-3 text-[#5A6E8A]">{c.cargo || '–'}</td>
                          <td className="p-3 text-[#1A2744] font-bold">{c.testes}</td>
                          <td className="p-3 text-emerald-600 font-bold">{c.aprovados}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-14 bg-slate-200 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{
                                  width: `${c.taxa}%`,
                                  background: c.taxa >= 75 ? '#059669' : c.taxa >= 50 ? '#D97706' : '#DC2626'
                                }}></div>
                              </div>
                              <span className={`font-black ${c.taxa >= 75 ? 'text-emerald-600' : c.taxa >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{c.taxa}%</span>
                            </div>
                          </td>
                          <td className="p-3 font-bold text-[#1A2744]">{c.media}%</td>
                          <td className="p-3 text-[#5A6E8A]">{c.trilhas}</td>
                          <td className="p-3">
                            {c.certs > 0
                              ? <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-lg">{c.certs} cert.</span>
                              : <span className="text-[#8A9BB0]">–</span>}
                          </td>
                          <td className="p-3 text-[#8A9BB0] whitespace-nowrap">
                            {c.ultimo ? (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                                c.ultimo.aprovado ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                              }`}>{c.ultimo.nota}% · {c.ultimo.aprovado ? 'Aprov.' : 'Reprov.'}</span>
                            ) : '–'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── POR TRILHA ───────────────────────────────────────────────── */}
            {tab === 'trilhas' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#FBF7EE] border-b border-[#E8D5A3]">
                        {['Trilha', 'Total de Testes', 'Aprovações', 'Taxa de Aprovação', 'Média', 'Testes c/ IA'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-[#5A6E8A] uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porTrilha.length === 0 && (
                        <tr><td colSpan={6} className="text-center p-8 text-[#8A9BB0]">Sem dados no período.</td></tr>
                      )}
                      {porTrilha.map((t, i) => {
                        const raw = filteredResults.filter(r => (r.trailTitle || 'Sem trilha') === t.name || (r.trailTitle || 'Sem trilha').startsWith(t.name.replace('…', '')));
                        const ia = raw.filter(r => r.ia).length;
                        return (
                          <tr key={i} className="border-b border-slate-100 hover:bg-[#FBF7EE] transition-all">
                            <td className="p-3 font-bold text-[#0A1628]">{t.name}</td>
                            <td className="p-3 text-[#1A2744] font-bold">{t.testes}</td>
                            <td className="p-3 text-emerald-600 font-bold">{Math.round(t.testes * t['Taxa (%)'] / 100)}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full" style={{
                                    width: `${t['Taxa (%)']}%`,
                                    background: t['Taxa (%)'] >= 75 ? '#059669' : t['Taxa (%)'] >= 50 ? '#D97706' : '#DC2626'
                                  }}></div>
                                </div>
                                <span className={`font-black ${t['Taxa (%)'] >= 75 ? 'text-emerald-600' : t['Taxa (%)'] >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {t['Taxa (%)']}%
                                </span>
                              </div>
                            </td>
                            <td className="p-3 font-bold text-[#1A2744]">{t['Média']}%</td>
                            <td className="p-3">
                              {ia > 0
                                ? <span className="bg-[#FBF5E0] text-[#1A3A6B] text-[10px] font-black px-2 py-0.5 rounded-lg border border-indigo-100">✨ {ia}</span>
                                : <span className="text-[#8A9BB0]">–</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── EVIDÊNCIAS ───────────────────────────────────────────────── */}
            {tab === 'evidencias' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-[#1A2744]">
                    {filteredResults.length} registros no período
                    <span className="text-[#8A9BB0] font-normal ml-2">— válidos como evidência para dossiê CNJ (Provimentos 149, 161 e 213)</span>
                  </p>
                  <button onClick={handlePrint} className="flex items-center gap-2 bg-white border border-[#E8D5A3] hover:border-slate-400 text-[#2C3E5A] px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"><i className="fa-solid fa-print text-xs"></i>Imprimir</button><button onClick={exportCSV}
                    className="flex items-center gap-2 bg-white border border-[#E8D5A3] hover:border-indigo-400 text-[#2C3E5A] hover:text-[#1A3A6B] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm">
                    <i className="fa-solid fa-file-excel"></i>CSV
                  </button>
                </div>
                <div className="overflow-x-auto border border-[#E8D5A3] rounded-[14px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#FBF7EE] border-b border-[#E8D5A3]">
                        {['Colaborador', 'Trilha', 'Módulo', 'Data/Hora', 'Nota', 'Status', 'Tipo'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-[#5A6E8A] uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.length === 0 && (
                        <tr><td colSpan={7} className="text-center p-8 text-[#8A9BB0]">Nenhum registro no período.</td></tr>
                      )}
                      {filteredResults.map(r => (
                        <tr key={r.id} className="border-b border-slate-100 hover:bg-[#FBF7EE] transition-all">
                          <td className="p-3 font-bold text-[#0A1628]">{r.colaborador}</td>
                          <td className="p-3 text-[#2C3E5A] max-w-[160px] truncate">{r.trailTitle || '–'}</td>
                          <td className="p-3 text-[#5A6E8A] max-w-[140px] truncate">{r.moduleTitle || '–'}</td>
                          <td className="p-3 text-[#8A9BB0] whitespace-nowrap">{formatDate(r.createdAt)}</td>
                          <td className="p-3 font-black" style={{ color: r.nota >= 75 ? '#059669' : '#DC2626' }}>{r.nota}%</td>
                          <td className="p-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                              r.aprovado
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-red-50 text-red-500 border border-red-200'
                            }`}>{r.aprovado ? 'Aprovado' : 'Reprovado'}</span>
                          </td>
                          <td className="p-3">
                            {r.ia
                              ? <span className="bg-[#FBF5E0] text-[#1A3A6B] text-[10px] font-black px-2 py-0.5 rounded-lg border border-indigo-100">✨ IA</span>
                              : <span className="text-[#8A9BB0] text-[10px]">Padrão</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatoriosView;
