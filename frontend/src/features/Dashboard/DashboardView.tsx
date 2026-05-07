// frontend/src/features/Dashboard/DashboardView.tsx
// Dashboard inspirado no protótipo CartórioLearn – estrutura idêntica, dados do Firebase

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, orderBy
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Modulo {
  id: string;
  titulo: string;
  duracao?: string;
  ordem: number;
}

interface Trilha {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
  cor: string;
  modulos: Modulo[];
  tenantId: string;
}

interface TrilhaProgresso {
  id: string;
  userId: string;
  userName: string;
  trilhaId: string;
  moduloId: string;
  concluido: boolean;
  tenantId: string;
}

interface QuizResult {
  id: string;
  userId?: string;
  colaborador: string;
  nota: number;
  aprovado: boolean;
  trailTitle?: string;
  moduleTitle?: string;
  ia?: boolean;
  tenantId: string;
  createdAt: any;
}

interface UserData {
  id: string;
  name: string;
  cargo?: string;
  role: string;
  tenantId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

function formatDate(ts: any): string {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const COR_FALLBACK: Record<number, string> = {
  0: '#4F46E5', 1: '#059669', 2: '#D97706',
  3: '#DC2626', 4: '#7C3AED', 5: '#0891B2',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: string; label: string; value: string | number; sub?: string; color: string;
}> = ({ icon, label, value, sub, color }) => (
  <div className="bg-[#0a111f] border border-slate-800 rounded-[16px] p-5">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3`}
      style={{ background: color + '20' }}>
      <i className={`fa-solid ${icon}`} style={{ color }}></i>
    </div>
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-3xl font-black text-white leading-none">{value}</p>
    {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
  </div>
);

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar: React.FC<{ value: number; color?: string; height?: number }> = ({
  value, color = '#4F46E5', height = 5
}) => (
  <div className="w-full bg-slate-800 rounded-full overflow-hidden" style={{ height }}>
    <div className="h-full rounded-full transition-all duration-700"
      style={{ width: `${value}%`, background: color }} />
  </div>
);

// ─── Chip ─────────────────────────────────────────────────────────────────────

const Chip: React.FC<{ label: string; type: 'green' | 'blue' | 'gray' | 'gold' | 'red' }> = ({ label, type }) => {
  const styles = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    gray:  'bg-slate-800 text-slate-400 border-slate-700',
    gold:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red:   'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-2.5 py-1 rounded-full border ${styles[type]}`}>
      {label}
    </span>
  );
};

// ─── COLLABORATOR DASHBOARD ───────────────────────────────────────────────────

const ColabDashboard: React.FC<{
  trilhas: Trilha[];
  progresso: TrilhaProgresso[];
  quizResults: QuizResult[];
  userName: string;
  userId: string;
}> = ({ trilhas, progresso, quizResults, userName, userId }) => {

  // Calcular stats
  const myProgress = progresso.filter(p => p.userId === userId || p.userName === userName);
  const myResults  = quizResults.filter(r => r.userId === userId || r.colaborador === userName);

  const totalMods = trilhas.reduce((a, t) => a + (t.modulos?.length ?? 0), 0);
  const doneMods  = myProgress.filter(p => p.concluido).length;
  const aprovacoes = myResults.filter(r => r.aprovado).length;
  const mediaGeral = myResults.length
    ? Math.round(myResults.reduce((a, r) => a + r.nota, 0) / myResults.length)
    : 0;
  const globalPct  = pct(doneMods, totalMods);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="fa-book-open"     label="Módulos Concluídos" value={`${doneMods}/${totalMods}`} sub={`${globalPct}% do programa`} color="#4F46E5" />
        <StatCard icon="fa-circle-check"  label="Aprovações"          value={aprovacoes}                sub={`de ${myResults.length} testes`}              color="#059669" />
        <StatCard icon="fa-medal"         label="Trilhas Concluídas"  value={trilhas.filter(t => {
          const mods = t.modulos?.length ?? 0;
          const done = myProgress.filter(p => (p.userId === userId || p.userName === userName) && p.trilhaId === t.id && p.concluido).length;
          return mods > 0 && done >= mods;
        }).length + '/' + trilhas.length}                                                               sub="Selos desbloqueados"                          color="#D97706" />
        <StatCard icon="fa-chart-bar"     label="Média Geral"         value={`${mediaGeral}%`}          sub="Nos testes realizados"                        color="#6B7280" />
      </div>

      {/* Progresso geral */}
      <div className="bg-[#0a111f] border border-slate-800 rounded-[16px] p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-black text-white">Progresso Geral do Programa</span>
          <span className="text-sm font-black text-indigo-400">{globalPct}%</span>
        </div>
        <ProgressBar value={globalPct} color="#4F46E5" height={6} />
        <p className="text-[11px] text-slate-500 mt-2">
          Aprovação mínima em cada teste: <strong className="text-slate-300">75%</strong> · Taxonomia de Bloom – Médio (Aplicar e Analisar)
        </p>
      </div>

      {/* Trilhas */}
      <div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Trilhas de Aprendizado</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trilhas.map((t, idx) => {
            const cor = t.cor || COR_FALLBACK[idx % 6];
            const mods = t.modulos?.length ?? 0;
            const done = myProgress.filter(p =>
              (p.userId === userId || p.userName === userName) && p.trilhaId === t.id && p.concluido
            ).length;
            const p = pct(done, mods);
            const chipType: 'green' | 'blue' | 'gray' = p === 100 ? 'green' : p > 0 ? 'blue' : 'gray';
            const chipLabel = p === 100 ? '✓ Concluída' : p > 0 ? `${p}%` : 'Iniciar';

            return (
              <div key={t.id}
                className="bg-[#0a111f] border border-slate-800 rounded-[16px] p-5 cursor-pointer hover:border-indigo-500/40 hover:translate-y-[-1px] transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: cor + '20', color: cor }}>
                    {t.icone || '📚'}
                  </div>
                  <Chip label={chipLabel} type={chipType} />
                </div>
                <h3 className="text-sm font-black text-white mb-1 leading-snug">{t.titulo}</h3>
                <p className="text-[11px] text-slate-500 mb-3 line-clamp-2">{t.descricao}</p>
                <p className="text-[10px] text-slate-600 mb-3">
                  {done}/{mods} módulos concluídos
                </p>
                <ProgressBar value={p} color={p === 100 ? '#059669' : cor} height={4} />
              </div>
            );
          })}
          {trilhas.length === 0 && (
            <div className="col-span-3 bg-[#0a111f] border border-slate-800 rounded-[16px] p-12 text-center">
              <i className="fa-solid fa-road text-4xl text-slate-700 mb-3 block"></i>
              <p className="text-slate-600 text-xs">Nenhuma trilha disponível ainda</p>
            </div>
          )}
        </div>
      </div>

      {/* Atividade recente */}
      {myResults.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Atividade Recente</p>
          <div className="space-y-2">
            {myResults.slice(0, 5).map((r, i) => (
              <div key={i} className="bg-[#0a111f] border border-slate-800 rounded-[14px] p-4 flex items-center gap-3">
                <i className={`fa-solid ${r.aprovado ? 'fa-circle-check text-emerald-400' : 'fa-circle-xmark text-red-400'} text-lg flex-shrink-0`}></i>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {r.trailTitle}{r.moduleTitle ? ` · ${r.moduleTitle}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-slate-500">{formatDate(r.createdAt)}</p>
                    {r.ia && <Chip label="✨ IA" type="blue" />}
                  </div>
                </div>
                <span className={`text-sm font-black ${r.aprovado ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.nota}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────

const AdminDashboard: React.FC<{
  trilhas: Trilha[];
  progresso: TrilhaProgresso[];
  quizResults: QuizResult[];
  usuarios: UserData[];
  tenantId: string;
  isSuperAdmin: boolean;
}> = ({ trilhas, progresso, quizResults, usuarios, tenantId, isSuperAdmin }) => {
  const [aba, setAba] = useState<'visao_geral' | 'colaboradores' | 'trilhas' | 'evidencias'>('visao_geral');

  const colab = usuarios.filter(u => u.role === 'colaborador' || u.role === 'user');
  const totalMods = trilhas.reduce((a, t) => a + (t.modulos?.length ?? 0), 0);

  const allTests = quizResults.length;
  const allPass  = quizResults.filter(r => r.aprovado).length;
  const totalDone = progresso.filter(p => p.concluido).length;
  const taxaConc  = pct(totalDone, Math.max(colab.length * totalMods, 1));
  const taxaAprov = pct(allPass, Math.max(allTests, 1));

  const getUserStats = (u: UserData) => {
    const prog = progresso.filter(p => p.userId === u.id || p.userName === u.name);
    const results = quizResults.filter(r => r.userId === u.id || r.colaborador === u.name);
    const done = prog.filter(p => p.concluido).length;
    const pass = results.filter(r => r.aprovado).length;
    const media = results.length ? Math.round(results.reduce((a, r) => a + r.nota, 0) / results.length) : 0;
    const last = results[0];
    return { done, pass, media, tests: results.length, last };
  };

  const exportCSV = () => {
    const rows = ['Colaborador,Cargo,Trilha,Módulo,Data,Nota,Status,Tipo'];
    quizResults.forEach(r => {
      const u = usuarios.find(x => x.id === r.userId || x.name === r.colaborador);
      rows.push([
        u?.name || r.colaborador, u?.cargo || '', r.trailTitle || '', r.moduleTitle || '',
        formatDate(r.createdAt), r.nota + '%', r.aprovado ? 'Aprovado' : 'Reprovado', r.ia ? 'IA' : 'Padrão'
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `evidencias_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const ABAS = [
    { id: 'visao_geral',    label: 'Visão Geral'    },
    { id: 'colaboradores',  label: 'Colaboradores'  },
    { id: 'trilhas',        label: 'Trilhas'        },
    { id: 'evidencias',     label: 'Evidências'     },
  ] as const;

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="fa-users"         label="Colaboradores"    value={colab.length}      color="#4F46E5" />
        <StatCard icon="fa-chart-line"    label="Taxa de Conclusão" value={`${taxaConc}%`}   sub="Módulos/total"              color="#059669" />
        <StatCard icon="fa-circle-check"  label="Taxa de Aprovação" value={`${taxaAprov}%`}  sub={`${allPass}/${allTests} testes`} color="#D97706" />
        <StatCard icon="fa-road"          label="Trilhas"           value={trilhas.length}   sub="Disponíveis"               color="#6B7280" />
      </div>

      {/* Abas */}
      <div className="flex gap-1.5 bg-slate-900 p-1 rounded-[14px]">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-[10px] transition-all ${
              aba === a.id ? 'bg-[#0a111f] text-white shadow' : 'text-slate-500 hover:text-slate-300'
            }`}>{a.label}</button>
        ))}
      </div>

      {/* Visão Geral */}
      {aba === 'visao_geral' && (
        <div className="bg-[#0a111f] border border-slate-800 rounded-[16px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900">
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Colaborador</th>
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Módulos</th>
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Progresso</th>
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Testes</th>
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Último</th>
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                </tr>
              </thead>
              <tbody>
                {colab.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-8 text-slate-600">Nenhum colaborador registrado ainda.</td></tr>
                ) : colab.map(u => {
                  const s = getUserStats(u);
                  const p = pct(s.done, totalMods);
                  return (
                    <tr key={u.id} className="border-t border-slate-800 hover:bg-slate-900/50 transition-all">
                      <td className="p-4">
                        <p className="font-bold text-white">{u.name}</p>
                        <p className="text-[10px] text-slate-500">{u.cargo || u.role}</p>
                      </td>
                      <td className="p-4 text-slate-300">{s.done}/{totalMods}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20"><ProgressBar value={p} color="#4F46E5" height={4} /></div>
                          <span className="text-[11px] font-bold text-slate-300">{p}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">{s.tests}</td>
                      <td className="p-4">
                        {s.last
                          ? <Chip label={`${s.last.nota}% – ${s.last.aprovado ? 'Aprovado' : 'Reprovado'}`} type={s.last.aprovado ? 'green' : 'red'} />
                          : <Chip label="Sem testes" type="gray" />}
                      </td>
                      <td className="p-4 text-[10px] text-slate-500">{s.last ? formatDate(s.last.createdAt) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Colaboradores */}
      {aba === 'colaboradores' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {colab.length === 0 && (
            <p className="text-slate-600 text-sm col-span-3 text-center py-8">Nenhum colaborador encontrado.</p>
          )}
          {colab.map(u => {
            const s = getUserStats(u);
            const p = pct(s.done, totalMods);
            const taxaA = s.tests ? pct(s.pass, s.tests) : 0;
            return (
              <div key={u.id} className="bg-[#0a111f] border border-slate-800 rounded-[16px] p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-black text-white">{u.name}</p>
                    <p className="text-[10px] text-slate-500">{u.cargo || u.role}</p>
                  </div>
                  <Chip label={p === 100 ? 'Concluído' : p > 0 ? `${p}%` : 'Não iniciado'} type={p === 100 ? 'green' : p > 0 ? 'blue' : 'gray'} />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Módulos',   value: `${s.done}/${totalMods}` },
                    { label: 'Testes',    value: s.tests },
                    { label: 'Aprovação', value: s.tests ? `${taxaA}%` : '–', color: taxaA >= 75 ? 'text-emerald-400' : taxaA > 0 ? 'text-amber-400' : 'text-slate-500' },
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-900 rounded-xl p-2.5 text-center">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest">{item.label}</p>
                      <p className={`text-base font-black mt-0.5 ${(item as any).color || 'text-white'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <ProgressBar value={p} color="#4F46E5" height={4} />
              </div>
            );
          })}
        </div>
      )}

      {/* Trilhas */}
      {aba === 'trilhas' && (
        <div className="space-y-4">
          <div className="bg-[#0a111f] border border-slate-800 rounded-[16px] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900">
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Trilha</th>
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Módulos</th>
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                  <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Concluintes</th>
                </tr>
              </thead>
              <tbody>
                {trilhas.map((t, idx) => {
                  const cor = t.cor || COR_FALLBACK[idx % 6];
                  const concluintes = colab.filter(u => {
                    const done = progresso.filter(p =>
                      (p.userId === u.id || p.userName === u.name) && p.trilhaId === t.id && p.concluido
                    ).length;
                    return (t.modulos?.length ?? 0) > 0 && done >= (t.modulos?.length ?? 0);
                  }).length;
                  return (
                    <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-900/50 transition-all">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ background: cor + '20', color: cor }}>
                            {t.icone || '📚'}
                          </div>
                          <div>
                            <p className="font-bold text-white">{t.titulo}</p>
                            <p className="text-[10px] text-slate-500 line-clamp-1">{t.descricao}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">{t.modulos?.length ?? 0}</td>
                      <td className="p-4"><Chip label="Padrão" type="blue" /></td>
                      <td className="p-4">
                        <Chip label={`${concluintes} colaborador${concluintes !== 1 ? 'es' : ''}`} type="green" />
                      </td>
                    </tr>
                  );
                })}
                {trilhas.length === 0 && (
                  <tr><td colSpan={4} className="text-center p-8 text-slate-600">Nenhuma trilha criada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-[14px] p-4 text-xs text-indigo-400">
            <i className="fa-solid fa-lightbulb mr-2"></i>
            <strong>Trilhas personalizadas</strong> são criadas no módulo de Trilhas de Aprendizado. Este painel exibe todas as trilhas ativas do cartório.
          </div>
        </div>
      )}

      {/* Evidências */}
      {aba === 'evidencias' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-white">Relatório de Evidências de Treinamento</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{quizResults.length} registros</p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportCSV}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                <i className="fa-solid fa-download mr-1.5"></i>Exportar CSV
              </button>
              <button onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                <i className="fa-solid fa-print mr-1.5"></i>Imprimir
              </button>
            </div>
          </div>
          <div className="bg-[#0a111f] border border-slate-800 rounded-[16px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-900">
                    {['Colaborador', 'Trilha', 'Módulo', 'Data', 'Nota', 'Status', 'Tipo'].map(h => (
                      <th key={h} className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quizResults.length === 0 ? (
                    <tr><td colSpan={7} className="text-center p-8 text-slate-600">Nenhum registro de treinamento ainda.</td></tr>
                  ) : quizResults.map((r, i) => (
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-900/50 transition-all">
                      <td className="p-4">
                        <p className="font-bold text-white">{r.colaborador}</p>
                      </td>
                      <td className="p-4 text-slate-400 text-[11px]">{r.trailTitle || '–'}</td>
                      <td className="p-4 text-slate-400 text-[11px]">{r.moduleTitle || '–'}</td>
                      <td className="p-4 text-[10px] text-slate-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                      <td className="p-4 font-black text-sm" style={{ color: r.aprovado ? '#34d399' : '#f87171' }}>{r.nota}%</td>
                      <td className="p-4"><Chip label={r.aprovado ? 'Aprovado' : 'Reprovado'} type={r.aprovado ? 'green' : 'red'} /></td>
                      <td className="p-4">{r.ia ? <Chip label="✨ IA" type="blue" /> : <span className="text-[10px] text-slate-500">Padrão</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const DashboardView: React.FC = () => {
  const { state } = useApp();
  const user = state.user!;
  const tenantId = user.tenantId;
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(user.role);

  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [progresso, setProgresso] = useState<TrilhaProgresso[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const q1 = query(collection(db, 'trilhas'), where('tenantId', '==', tenantId), orderBy('createdAt'));
    unsubs.push(onSnapshot(q1, s => setTrilhas(s.docs.map(d => ({ id: d.id, ...d.data() } as Trilha)))));

    const q2 = query(collection(db, 'trilhasProgresso'), where('tenantId', '==', tenantId));
    unsubs.push(onSnapshot(q2, s => setProgresso(s.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaProgresso)))));

    const q3 = query(collection(db, 'treinamentosQuizResults'), orderBy('createdAt', 'desc'));
    unsubs.push(onSnapshot(q3, s => {
      setQuizResults(s.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult)));
      setLoading(false);
    }));

    if (isGestor) {
      const q4 = query(collection(db, 'users'), where('tenantId', '==', tenantId));
      unsubs.push(onSnapshot(q4, s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as UserData)))));
    }

    return () => unsubs.forEach(u => u());
  }, [tenantId, isGestor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#05080f]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 bg-[#05080f] min-h-screen">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">
            {isGestor ? 'Painel Geral' : `Olá, ${user.name.split(' ')[0]} 👋`}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {isGestor ? 'Acompanhe o desempenho da sua equipe' : 'Plataforma de Conformidade Notarial'}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl">
          <i className="fa-solid fa-brain text-indigo-400 text-xs"></i>
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Bloom Médio · 75% aprovação</span>
        </div>
      </header>

      {/* Dashboard */}
      {isGestor ? (
        <AdminDashboard
          trilhas={trilhas}
          progresso={progresso}
          quizResults={quizResults}
          usuarios={usuarios}
          tenantId={tenantId}
          isSuperAdmin={user.role === 'SUPERADMIN'}
        />
      ) : (
        <ColabDashboard
          trilhas={trilhas}
          progresso={progresso}
          quizResults={quizResults}
          userName={user.name}
          userId={user.id}
        />
      )}
    </div>
  );
};

export default DashboardView;
