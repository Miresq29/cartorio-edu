// frontend/src/features/Dashboard/DashboardView.tsx
// Dashboard com gráficos variados — recharts, tema claro, layout colaboradores

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';

interface QuizResult {
  id: string; colaborador: string; userId?: string; nota: number; aprovado: boolean;
  trailTitle?: string; moduleTitle?: string; ia?: boolean; tenantId?: string; createdAt: any;
}
interface TrilhaProgresso {
  id: string; userId: string; userName: string; trilhaId: string;
  trilhaTitulo?: string; concluido: boolean; tenantId: string;
}
interface Trilha { id: string; titulo: string; descricao: string; icone: string; cor: string; modulos: any[]; tenantId: string; }
interface UserData { id: string; name: string; cargo?: string; role: string; tenantId: string; }
interface Certificado { id: string; colaboradorNome: string; trilhaTitulo: string; notaFinal: number; emitidoEm: any; tenantId: string; }

function pct(a: number, b: number) { return b === 0 ? 0 : Math.round((a / b) * 100); }
function getMonth(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}
function formatDate(ts: any): string {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const COLORS = ['#4F46E5','#059669','#D97706','#DC2626','#7C3AED','#0891B2','#EC4899'];

const Tip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-xl p-3 shadow-lg text-xs">
      {label && <p className="font-black text-slate-200 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}{typeof p.value === 'number' && p.name?.includes('%') ? '%' : ''}</p>
      ))}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; icon: string; color: string; trend?: number }> = ({ label, value, sub, icon, color, trend }) => (
  <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '15' }}>
        <i className={'fa-solid ' + icon} style={{ color }}></i>
      </div>
      {trend !== undefined && (
        <span className={'text-[10px] font-black px-2 py-1 rounded-lg ' + (trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-3xl font-black text-white">{value}</p>
    {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
  </div>
);

// ── COLABORADOR DASHBOARD ────────────────────────────────────────────────────

const ColabDashboard: React.FC<{
  trilhas: Trilha[]; progresso: TrilhaProgresso[]; quizResults: QuizResult[];
  certificados: Certificado[]; userName: string; userId: string;
}> = ({ trilhas, progresso, quizResults, certificados, userName, userId }) => {
  const myProg  = progresso.filter(p => p.userId === userId || p.userName === userName);
  const myRes   = quizResults.filter(r => r.userId === userId || r.colaborador === userName);
  const myCerts = certificados.filter(c => c.colaboradorNome === userName);

  const totalMods   = trilhas.reduce((a, t) => a + (t.modulos?.length ?? 0), 0);
  const doneMods    = myProg.filter(p => p.concluido).length;
  const aprovacoes  = myRes.filter(r => r.aprovado).length;
  const mediaGeral  = myRes.length ? Math.round(myRes.reduce((a, r) => a + r.nota, 0) / myRes.length) : 0;
  const globalPct   = pct(doneMods, totalMods);

  // Dados para gráfico de linha — notas ao longo do tempo
  const evolucao = useMemo(() => {
    const map: Record<string, { mes: string; media: number; total: number }> = {};
    myRes.forEach(r => {
      const m = getMonth(r.createdAt);
      if (!m) return;
      if (!map[m]) map[m] = { mes: m, media: 0, total: 0 };
      map[m].media += r.nota;
      map[m].total++;
    });
    return Object.values(map).slice(-6).map(x => ({ mes: x.mes, 'Média (%)': Math.round(x.media / x.total) }));
  }, [myRes]);

  // Dados para gráfico de barras — performance por trilha
  const porTrilha = useMemo(() => {
    return trilhas.slice(0, 6).map(t => {
      const mods  = t.modulos?.length ?? 0;
      const done  = myProg.filter(p => p.trilhaId === t.id && p.concluido).length;
      const res   = myRes.filter(r => r.trailTitle === t.titulo);
      const media = res.length ? Math.round(res.reduce((a, r) => a + r.nota, 0) / res.length) : 0;
      return {
        name: t.titulo.length > 16 ? t.titulo.slice(0, 14) + '…' : t.titulo,
        'Conclusão (%)': pct(done, mods),
        'Média notas': media,
      };
    });
  }, [trilhas, myProg, myRes]);

  // Donut — status das trilhas
  const statusTrilhas = useMemo(() => {
    const concluidas  = trilhas.filter(t => { const mods = t.modulos?.length ?? 0; const done = myProg.filter(p => p.trilhaId === t.id && p.concluido).length; return mods > 0 && done >= mods; }).length;
    const emAndamento = trilhas.filter(t => { const done = myProg.filter(p => p.trilhaId === t.id && p.concluido).length; return done > 0 && done < (t.modulos?.length ?? 0); }).length;
    const naoCom      = trilhas.length - concluidas - emAndamento;
    return [
      { name: 'Concluídas',    value: concluidas,  color: '#059669' },
      { name: 'Em andamento',  value: emAndamento, color: '#4F46E5' },
      { name: 'Não iniciadas', value: naoCom,      color: '#e2e8f0' },
    ].filter(x => x.value > 0);
  }, [trilhas, myProg]);

  // Radar — habilidades por categoria de trilha
  const radarData = useMemo(() => {
    const cats = ['Onboarding', 'Normativo', 'Técnico', 'Operacional', 'Comportamental'];
    return cats.map(cat => {
      const res = myRes.filter(r => r.trailTitle?.toLowerCase().includes(cat.toLowerCase()));
      return { subject: cat, score: res.length ? Math.round(res.reduce((a, r) => a + r.nota, 0) / res.length) : 0 };
    });
  }, [myRes]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Módulos Concluídos" value={`${doneMods}/${totalMods}`} sub={`${globalPct}% do programa`} icon="fa-book-open"    color="#4F46E5" />
        <StatCard label="Aprovações"          value={aprovacoes}                sub={`de ${myRes.length} testes`}   icon="fa-circle-check" color="#059669" />
        <StatCard label="Média Geral"         value={`${mediaGeral}%`}          sub="nos testes realizados"         icon="fa-chart-bar"    color="#D97706" />
        <StatCard label="Certificados"        value={myCerts.length}            sub="emitidos"                      icon="fa-certificate"  color="#7C3AED" />
      </div>

      {/* Progresso geral */}
      <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-black text-white">Progresso Geral do Programa</span>
          <span className="text-sm font-black text-[#C9A84C]">{globalPct}%</span>
        </div>
        <div className="w-full bg-[#132044] rounded-full h-2.5">
          <div className="h-2.5 rounded-full bg-[#C9A84C] transition-all duration-700" style={{ width: `${globalPct}%` }}></div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Aprovação mínima: <strong className="text-slate-300">75%</strong> · Taxonomia de Bloom Médio</p>
      </div>

      {/* Linha 1: Evolução + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Evolução das Notas</p>
          {evolucao.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Nenhum teste realizado ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={evolucao} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNota" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="Média (%)" stroke="#4F46E5" strokeWidth={2} fill="url(#colorNota)" dot={{ r: 4, fill: '#4F46E5' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Status das Trilhas</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusTrilhas} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {statusTrilhas.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<Tip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {statusTrilhas.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }}></div>
                  <span className="text-[11px] text-slate-400">{s.name}</span>
                </div>
                <span className="text-[11px] font-black text-slate-200">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linha 2: Barras por trilha + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Conclusão e Notas por Trilha</p>
          {porTrilha.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Sem dados ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porTrilha} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-20} textAnchor="end" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Conclusão (%)" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Média notas"   fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Perfil de Habilidades</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <Radar name="Média" dataKey="score" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.15} strokeWidth={2} />
              <Tooltip content={<Tip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trilhas */}
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Trilhas de Aprendizado</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trilhas.map((t, idx) => {
            const cor  = t.cor || COLORS[idx % COLORS.length];
            const mods = t.modulos?.length ?? 0;
            const done = myProg.filter(p => (p.userId === userId || p.userName === userName) && p.trilhaId === t.id && p.concluido).length;
            const p    = pct(done, mods);
            const chipColor = p === 100 ? '#059669' : p > 0 ? '#4F46E5' : '#94a3b8';
            const chipBg    = p === 100 ? '#d1fae5' : p > 0 ? '#eef2ff' : '#f1f5f9';
            const chipLabel = p === 100 ? '✓ Concluída' : p > 0 ? `${p}%` : 'Iniciar';
            return (
              <div key={t.id} className="bg-[#1A2A52] border border-[#C9A84C]/30 hover:border-[#C9A84C]/50 rounded-[14px] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center text-xl" style={{ background: cor + '20', color: cor }}>
                    {t.icone || '📚'}
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: chipBg, color: chipColor }}>{chipLabel}</span>
                </div>
                <h3 className="text-sm font-black text-white mb-1 leading-snug">{t.titulo}</h3>
                <p className="text-[11px] text-slate-500 mb-3 line-clamp-2">{t.descricao}</p>
                <p className="text-[10px] text-slate-500 mb-2">{done}/{mods} módulos</p>
                <div className="w-full bg-[#132044] rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${p}%`, background: p === 100 ? '#059669' : cor }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Atividade recente */}
      {myRes.length > 0 && (
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Atividade Recente</p>
          <div className="space-y-2">
            {myRes.slice(0, 5).map((r, i) => (
              <div key={i} className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[12px] p-4 flex items-center gap-3 shadow-sm">
                <i className={'fa-solid text-lg flex-shrink-0 ' + (r.aprovado ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-red-400')}></i>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{r.trailTitle}{r.moduleTitle ? ' · ' + r.moduleTitle : ''}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-slate-500">{formatDate(r.createdAt)}</p>
                    {r.ia && <span className="text-[9px] font-black bg-[#1A2A52] text-[#C9A84C] px-1.5 py-0.5 rounded-lg">✨ IA</span>}
                  </div>
                </div>
                <span className={'text-sm font-black ' + (r.aprovado ? 'text-emerald-600' : 'text-red-500')}>{r.nota}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── ADMIN DASHBOARD ──────────────────────────────────────────────────────────

const AdminDashboard: React.FC<{
  trilhas: Trilha[]; progresso: TrilhaProgresso[]; quizResults: QuizResult[];
  usuarios: UserData[]; certificados: Certificado[]; tenantId: string;
}> = ({ trilhas, progresso, quizResults, usuarios, certificados }) => {
  const colab = usuarios.filter(u => !['SUPERADMIN', 'gestor'].includes(u.role));
  const totalMods  = trilhas.reduce((a, t) => a + (t.modulos?.length ?? 0), 0);
  const allTests   = quizResults.length;
  const allPass    = quizResults.filter(r => r.aprovado).length;
  const taxaAprov  = pct(allPass, allTests);
  const totalDone  = progresso.filter(p => p.concluido).length;
  const mediaGeral = allTests ? Math.round(quizResults.reduce((a, r) => a + r.nota, 0) / allTests) : 0;

  // Linha: testes por mês
  const testesPorMes = useMemo(() => {
    const map: Record<string, { mes: string; Testes: number; Aprovados: number }> = {};
    quizResults.forEach(r => {
      const m = getMonth(r.createdAt);
      if (!m) return;
      if (!map[m]) map[m] = { mes: m, Testes: 0, Aprovados: 0 };
      map[m].Testes++;
      if (r.aprovado) map[m].Aprovados++;
    });
    return Object.values(map).slice(-6);
  }, [quizResults]);

  // Barras: top trilhas por taxa de aprovação
  const trilhasPerf = useMemo(() => {
    return trilhas.slice(0, 8).map(t => {
      const res = quizResults.filter(r => r.trailTitle === t.titulo);
      const taxa = res.length ? pct(res.filter(r => r.aprovado).length, res.length) : 0;
      return { name: t.titulo.slice(0, 14) + (t.titulo.length > 14 ? '…' : ''), 'Taxa (%)': taxa, Testes: res.length };
    }).filter(t => t.Testes > 0).sort((a, b) => b['Taxa (%)'] - a['Taxa (%)']);
  }, [trilhas, quizResults]);

  // Donut: distribuição de perfis
  const perfisData = useMemo(() => {
    const map: Record<string, number> = {};
    usuarios.forEach(u => { map[u.role] = (map[u.role] || 0) + 1; });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i] }));
  }, [usuarios]);

  // Barras horizontais: top colaboradores
  const topColab = useMemo(() => {
    return colab.map(u => {
      const res = quizResults.filter(r => r.userId === u.id || r.colaborador === u.name);
      return { name: u.name.split(' ')[0], media: res.length ? Math.round(res.reduce((a, r) => a + r.nota, 0) / res.length) : 0, testes: res.length };
    }).filter(u => u.testes > 0).sort((a, b) => b.media - a.media).slice(0, 8);
  }, [colab, quizResults]);

  // Distribuição de notas
  const distNotas = useMemo(() => [
    { faixa: '0–49',   value: quizResults.filter(r => r.nota < 50).length,                      color: '#DC2626' },
    { faixa: '50–69',  value: quizResults.filter(r => r.nota >= 50 && r.nota < 70).length,       color: '#D97706' },
    { faixa: '70–84',  value: quizResults.filter(r => r.nota >= 70 && r.nota < 85).length,       color: '#059669' },
    { faixa: '85–100', value: quizResults.filter(r => r.nota >= 85).length,                      color: '#4F46E5' },
  ], [quizResults]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Colaboradores"   value={colab.length}       sub="cadastrados"                        icon="fa-users"         color="#4F46E5" />
        <StatCard label="Taxa Aprovação"  value={`${taxaAprov}%`}    sub={`${allPass}/${allTests} testes`}    icon="fa-circle-check"  color="#059669" />
        <StatCard label="Média Geral"     value={`${mediaGeral}%`}   sub="em todos os testes"                 icon="fa-chart-bar"     color="#D97706" />
        <StatCard label="Certificados"    value={certificados.length} sub="emitidos no total"                 icon="fa-certificate"   color="#7C3AED" />
      </div>

      {/* Linha 1: Testes por mês + Distribuição notas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Atividade Mensal da Equipe</p>
          {testesPorMes.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Sem dados ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={testesPorMes} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Testes"    stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Aprovados" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Distribuição de Notas</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={distNotas} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" nameKey="faixa" paddingAngle={3}>
                {distNotas.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<Tip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {distNotas.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }}></div>
                <span className="text-[10px] text-slate-400">{d.faixa}%: <strong className="text-slate-200">{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linha 2: Performance por trilha + Top colaboradores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Taxa de Aprovação por Trilha</p>
          {trilhasPerf.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Sem dados ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trilhasPerf} margin={{ top: 5, right: 10, left: -20, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-20} textAnchor="end" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="Taxa (%)" radius={[4,4,0,0]}>
                  {trilhasPerf.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Perfis de Acesso</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={perfisData} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {perfisData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<Tip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {perfisData.map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }}></div>
                  <span className="text-[11px] text-slate-400">{p.name}</span>
                </div>
                <span className="text-[11px] font-black text-slate-200">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top colaboradores */}
      {topColab.length > 0 && (
        <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[14px] p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Ranking de Desempenho — Top Colaboradores</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topColab} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={70} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="media" name="Média (%)" radius={[0, 4, 4, 0]}>
                {topColab.map((e, i) => <Cell key={i} fill={e.media >= 75 ? '#059669' : e.media >= 50 ? '#D97706' : '#DC2626'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// ── MAIN ─────────────────────────────────────────────────────────────────────

const DashboardView: React.FC = () => {
  const { state } = useApp();
  const user = state.user!;
  const tenantId = user.tenantId;
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(user.role);

  const [trilhas, setTrilhas]           = useState<Trilha[]>([]);
  const [progresso, setProgresso]       = useState<TrilhaProgresso[]>([]);
  const [quizResults, setQuizResults]   = useState<QuizResult[]>([]);
  const [usuarios, setUsuarios]         = useState<UserData[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(query(collection(db,'trilhas'), where('tenantId','==',tenantId)), s => setTrilhas(s.docs.map(d => ({id:d.id,...d.data()} as Trilha)))));
    unsubs.push(onSnapshot(query(collection(db,'trilhasProgresso'), where('tenantId','==',tenantId)), s => setProgresso(s.docs.map(d => ({id:d.id,...d.data()} as TrilhaProgresso)))));
    unsubs.push(onSnapshot(query(collection(db,'treinamentosQuizResults'), orderBy('createdAt','desc')), s => { setQuizResults(s.docs.map(d => ({id:d.id,...d.data()} as QuizResult))); setLoading(false); }));
    unsubs.push(onSnapshot(query(collection(db,'users')), s => setUsuarios(s.docs.map(d => ({id:d.id,...d.data()} as UserData)))));
    unsubs.push(onSnapshot(query(collection(db,'certificados'), where('tenantId','==',tenantId)), s => setCertificados(s.docs.map(d => ({id:d.id,...d.data()} as Certificado)))));
    return () => unsubs.forEach(u => u());
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1B3E]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#C9A84C]/30 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 text-sm">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B3E]">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">
              {isGestor ? 'Painel Geral' : `Olá, ${user.name.split(' ')[0]} 👋`}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isGestor ? 'Acompanhe o desempenho da sua equipe' : 'Plataforma de Conformidade Notarial'}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-[#1A2A52] border border-[#C9A84C]/30 px-3 py-2 rounded-xl">
            <i className="fa-solid fa-brain text-[#C9A84C] text-xs"></i>
            <span className="text-[10px] font-black text-[#C9A84C] uppercase tracking-widest">Bloom Médio · 75% aprovação</span>
          </div>
        </div>

        {isGestor ? (
          <AdminDashboard trilhas={trilhas} progresso={progresso} quizResults={quizResults} usuarios={usuarios} certificados={certificados} tenantId={tenantId} />
        ) : (
          <ColabDashboard trilhas={trilhas} progresso={progresso} quizResults={quizResults} certificados={certificados} userName={user.name} userId={user.id} />
        )}
      </div>
    </div>
  );
};

export default DashboardView;
