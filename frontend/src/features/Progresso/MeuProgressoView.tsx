// frontend/src/features/Progresso/MeuProgressoView.tsx
// Meu Progresso — Trilhas, Badges, Certificados, Histórico

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';

interface Trilha { id: string; titulo: string; descricao: string; icone: string; cor: string; modulos: any[]; tenantId: string; }
interface TrilhaProgresso { id: string; userId: string; userName: string; trilhaId: string; trilhaTitulo?: string; concluido: boolean; tenantId: string; }
interface QuizResult { id: string; colaborador: string; userId?: string; nota: number; aprovado: boolean; trailTitle?: string; moduleTitle?: string; ia?: boolean; createdAt: any; }
interface Certificado { id: string; colaboradorNome: string; trilhaTitulo: string; notaFinal: number; emitidoEm: any; tenantId: string; codigoVerificacao?: string; }

function pct(a: number, b: number) { return b === 0 ? 0 : Math.round((a / b) * 100); }
function formatDate(ts: any) {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── BADGE DEFINITIONS ────────────────────────────────────────────────────────

interface BadgeDef {
  id: string; nome: string; desc: string; icon: string;
  color: string; bg: string; border: string;
  check: (data: BadgeData) => boolean;
  nivel: 'bronze' | 'prata' | 'ouro' | 'platina';
}

interface BadgeData {
  trilhas: Trilha[]; progresso: TrilhaProgresso[]; quizResults: QuizResult[];
  certificados: Certificado[]; userId: string; userName: string;
}

const BADGES: BadgeDef[] = [
  // Primeiros passos
  { id: 'primeiro_teste',   nome: 'Primeiro Passo',      desc: 'Realizou o primeiro teste',              icon: 'fa-shoe-prints',       color: '#92400e', bg: '#fef3c7', border: '#fbbf24', nivel: 'bronze',  check: (d) => d.quizResults.length >= 1 },
  { id: 'aprovado',         nome: 'Aprovado',             desc: 'Passou em um teste com nota ≥ 75%',      icon: 'fa-circle-check',      color: '#065f46', bg: '#d1fae5', border: '#34d399', nivel: 'bronze',  check: (d) => d.quizResults.some(r => r.aprovado) },
  { id: 'modulo_concluido', nome: 'Módulo Concluído',     desc: 'Concluiu o primeiro módulo',             icon: 'fa-book-open-reader',  color: '#1e40af', bg: '#dbeafe', border: '#60a5fa', nivel: 'bronze',  check: (d) => d.progresso.filter(p => p.concluido).length >= 1 },
  // Desempenho
  { id: 'nota_90',          nome: 'Excelência',           desc: 'Obteve nota ≥ 90% em algum teste',       icon: 'fa-star',              color: '#b45309', bg: '#fef9c3', border: '#fbbf24', nivel: 'prata',   check: (d) => d.quizResults.some(r => r.nota >= 90) },
  { id: 'nota_100',         nome: 'Perfeição',            desc: 'Obteve nota 100% em algum teste',        icon: 'fa-crown',             color: '#7c3aed', bg: '#ede9fe', border: '#a78bfa', nivel: 'ouro',    check: (d) => d.quizResults.some(r => r.nota >= 100) },
  { id: 'sem_erros',        nome: 'Zero Erro',            desc: '5 testes consecutivos aprovados',        icon: 'fa-shield-halved',     color: '#065f46', bg: '#d1fae5', border: '#10b981', nivel: 'prata',   check: (d) => { let seq = 0; for (const r of [...d.quizResults].reverse()) { if (r.aprovado) seq++; else break; } return seq >= 5; } },
  // IA
  { id: 'teste_ia',         nome: 'IA Explorer',          desc: 'Realizou teste gerado por IA',           icon: 'fa-robot',             color: '#4338ca', bg: '#eef2ff', border: '#818cf8', nivel: 'prata',   check: (d) => d.quizResults.some(r => r.ia) },
  { id: 'mestre_ia',        nome: 'Mestre IA',            desc: '10 testes com IA aprovados',             icon: 'fa-brain',             color: '#7c3aed', bg: '#f5f3ff', border: '#a78bfa', nivel: 'ouro',    check: (d) => d.quizResults.filter(r => r.ia && r.aprovado).length >= 10 },
  // Trilhas
  { id: 'trilha_lgpd',      nome: 'Guardião LGPD',        desc: 'Concluiu a trilha LGPD',                 icon: 'fa-lock',              color: '#0f766e', bg: '#ccfbf1', border: '#2dd4bf', nivel: 'ouro',    check: (d) => d.progresso.some(p => p.concluido && p.trilhaTitulo?.toLowerCase().includes('lgpd')) },
  { id: 'trilha_p213',      nome: 'Cyber Shield',         desc: 'Concluiu a trilha Provimento 213',       icon: 'fa-shield-virus',      color: '#1d4ed8', bg: '#dbeafe', border: '#3b82f6', nivel: 'ouro',    check: (d) => d.progresso.some(p => p.concluido && p.trilhaTitulo?.toLowerCase().includes('213')) },
  { id: 'trilha_p161',      nome: 'Vigilante PLD',        desc: 'Concluiu a trilha Provimento 161',       icon: 'fa-eye',               color: '#b45309', bg: '#fef3c7', border: '#f59e0b', nivel: 'ouro',    check: (d) => d.progresso.some(p => p.concluido && p.trilhaTitulo?.toLowerCase().includes('161')) },
  { id: 'todas_trilhas',    nome: 'Mestre Notarial',      desc: 'Concluiu todas as trilhas disponíveis',  icon: 'fa-graduation-cap',    color: '#7c3aed', bg: '#f5f3ff', border: '#7c3aed', nivel: 'platina', check: (d) => { const total = d.trilhas.length; const done = new Set(d.progresso.filter(p => p.concluido).map(p => p.trilhaId)).size; return total > 0 && done >= total; } },
  // Certificados
  { id: 'primeiro_cert',    nome: 'Certificado',          desc: 'Emitiu o primeiro certificado',          icon: 'fa-certificate',       color: '#b45309', bg: '#fefce8', border: '#eab308', nivel: 'prata',   check: (d) => d.certificados.length >= 1 },
  { id: 'tres_certs',       nome: 'Colecionador',         desc: 'Emitiu 3 certificados',                  icon: 'fa-medal',             color: '#0369a1', bg: '#e0f2fe', border: '#38bdf8', nivel: 'ouro',    check: (d) => d.certificados.length >= 3 },
  // Engajamento
  { id: 'dez_testes',       nome: 'Dedicado',             desc: 'Realizou 10 testes',                     icon: 'fa-fire',              color: '#dc2626', bg: '#fee2e2', border: '#f87171', nivel: 'prata',   check: (d) => d.quizResults.length >= 10 },
  { id: 'trinta_testes',    nome: 'Imparável',            desc: 'Realizou 30 testes',                     icon: 'fa-bolt',              color: '#d97706', bg: '#fef3c7', border: '#fbbf24', nivel: 'platina', check: (d) => d.quizResults.length >= 30 },
];

const NIVEL_CONFIG = {
  bronze:  { label: 'Bronze',  color: '#92400e', bg: '#fef3c7', icon: 'fa-circle' },
  prata:   { label: 'Prata',   color: '#475569', bg: '#f1f5f9', icon: 'fa-circle' },
  ouro:    { label: 'Ouro',    color: '#b45309', bg: '#fefce8', icon: 'fa-circle' },
  platina: { label: 'Platina', color: '#7c3aed', bg: '#f5f3ff', icon: 'fa-circle' },
};

// ── BADGE CARD ────────────────────────────────────────────────────────────────

const BadgeCard: React.FC<{ badge: BadgeDef; earned: boolean }> = ({ badge, earned }) => {
  const nc = NIVEL_CONFIG[badge.nivel];
  return (
    <div className={'rounded-[14px] border p-4 flex flex-col items-center gap-2 text-center transition-all ' +
      (earned ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-white/50 border-slate-200 opacity-40 grayscale')}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 shadow-sm"
        style={{ background: earned ? badge.bg : '#f1f5f9', borderColor: earned ? badge.border : '#e2e8f0' }}>
        <i className={'fa-solid ' + badge.icon} style={{ color: earned ? badge.color : '#94a3b8' }}></i>
      </div>
      <div>
        <p className="text-xs font-black text-[#0A1628] leading-tight">{badge.nome}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{badge.desc}</p>
      </div>
      <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
        style={{ background: nc.bg, color: nc.color }}>
        {nc.label}
      </span>
      {!earned && <span className="text-[9px] text-slate-500 font-bold">Bloqueado</span>}
    </div>
  );
};

// ── MAIN ─────────────────────────────────────────────────────────────────────

type Tab = 'resumo' | 'badges' | 'historico' | 'certificados';

const MeuProgressoView: React.FC = () => {
  const { state } = useApp();
  const user = state.user!;
  const tenantId = user.tenantId;
  const userId = user.id;
  const userName = user.name;

  const [tab, setTab] = useState<Tab>('resumo');
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [progresso, setProgresso] = useState<TrilhaProgresso[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(query(collection(db,'trilhas'), where('tenantId','==',tenantId)), s => setTrilhas(s.docs.map(d => ({id:d.id,...d.data()} as Trilha)))));
    unsubs.push(onSnapshot(query(collection(db,'trilhasProgresso'), where('tenantId','==',tenantId)), s => setProgresso(s.docs.map(d => ({id:d.id,...d.data()} as TrilhaProgresso)))));
    unsubs.push(onSnapshot(query(collection(db,'treinamentosQuizResults'), orderBy('createdAt','desc')), s => { setQuizResults(s.docs.map(d => ({id:d.id,...d.data()} as QuizResult))); setLoading(false); }));
    unsubs.push(onSnapshot(query(collection(db,'certificados'), where('tenantId','==',tenantId)), s => setCertificados(s.docs.map(d => ({id:d.id,...d.data()} as Certificado)))));
    return () => unsubs.forEach(u => u());
  }, [tenantId]);

  const myProg  = progresso.filter(p => p.userId === userId || p.userName === userName);
  const myRes   = quizResults.filter(r => r.userId === userId || r.colaborador === userName);
  const myCerts = certificados.filter(c => c.colaboradorNome === userName);

  const totalMods  = trilhas.reduce((a, t) => a + (t.modulos?.length ?? 0), 0);
  const doneMods   = myProg.filter(p => p.concluido).length;
  const aprovados  = myRes.filter(r => r.aprovado).length;
  const mediaGeral = myRes.length ? Math.round(myRes.reduce((a, r) => a + r.nota, 0) / myRes.length) : 0;
  const globalPct  = pct(doneMods, totalMods);

  const badgeData: BadgeData = { trilhas, progresso: myProg, quizResults: myRes, certificados: myCerts, userId, userName };
  const earnedBadges = BADGES.filter(b => b.check(badgeData));
  const totalBadges  = BADGES.length;

  const badgesByNivel = useMemo(() => {
    const map: Record<string, BadgeDef[]> = { platina: [], ouro: [], prata: [], bronze: [] };
    BADGES.forEach(b => map[b.nivel].push(b));
    return map;
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0D1B3E]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-500 text-sm">Carregando...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0D1B3E]">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#C9A84C] flex items-center justify-center text-[#0A1628] text-xl font-black shadow-lg">
            {userName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#0A1628]">{userName}</h2>
            <p className="text-sm text-slate-500">{user.cargo || 'Colaborador'} · {earnedBadges.length}/{totalBadges} badges conquistados</p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl">
            <i className="fa-solid fa-trophy text-[#C9A84C] text-xs"></i>
            <span className="text-[10px] font-black text-[#C9A84C] uppercase tracking-widest">{earnedBadges.length} conquistas</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Módulos',      value: `${doneMods}/${totalMods}`, sub: `${globalPct}% concluído`, icon: 'fa-book-open',    color: '#4F46E5' },
            { label: 'Aprovações',   value: aprovados,                  sub: `de ${myRes.length} testes`, icon: 'fa-circle-check', color: '#059669' },
            { label: 'Média Geral',  value: `${mediaGeral}%`,           sub: 'nos testes',              icon: 'fa-chart-bar',    color: '#D97706' },
            { label: 'Certificados', value: myCerts.length,             sub: 'emitidos',                icon: 'fa-certificate',  color: '#7C3AED' },
          ].map((k, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-[14px] p-5 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + '15' }}>
                <i className={'fa-solid ' + k.icon} style={{ color: k.color }}></i>
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{k.label}</p>
              <p className="text-3xl font-black text-[#0A1628]">{k.value}</p>
              <p className="text-[11px] text-slate-500 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Barra de progresso geral */}
        <div className="bg-white border border-slate-200 rounded-[14px] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-black text-[#0A1628]">Progresso no Programa</span>
            <span className="text-sm font-black text-[#C9A84C]">{globalPct}%</span>
          </div>
          <div className="w-full bg-white rounded-full h-2.5">
            <div className="h-2.5 rounded-full bg-[#C9A84C] transition-all duration-700" style={{ width: `${globalPct}%` }}></div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-[11px] text-slate-500">Aprovação mínima: <strong className="text-slate-600">75%</strong></span>
            <span className="text-[11px] text-slate-500">Badges: <strong className="text-slate-600">{earnedBadges.length}/{totalBadges}</strong></span>
            <span className="text-[11px] text-slate-500">Certificados: <strong className="text-slate-600">{myCerts.length}</strong></span>
          </div>
        </div>

        {/* Abas */}
        <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {[
              { id: 'resumo',       label: 'Trilhas',      icon: 'fa-road'          },
              { id: 'badges',       label: 'Badges',       icon: 'fa-medal'         },
              { id: 'historico',    label: 'Histórico',    icon: 'fa-clock-rotate-left' },
              { id: 'certificados', label: 'Certificados', icon: 'fa-certificate'   },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as Tab)}
                className={'flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ' +
                  (tab === t.id ? 'border-[#C9A84C] text-[#C9A84C] bg-white/50' : 'border-transparent text-slate-500 hover:text-slate-600')}>
                <i className={'fa-solid ' + t.icon}></i>{t.label}
                {t.id === 'badges' && earnedBadges.length > 0 && (
                  <span className="bg-[#C9A84C] text-[#0A1628] text-[9px] font-black px-1.5 py-0.5 rounded-full">{earnedBadges.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── TRILHAS ──────────────────────────────────────────────── */}
          {tab === 'resumo' && (
            <div className="p-5">
              {trilhas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <i className="fa-solid fa-road text-4xl mb-3 opacity-30"></i>
                  <p className="text-sm">Nenhuma trilha disponível ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trilhas.map((t, idx) => {
                    const COLORS = ['#4F46E5','#059669','#D97706','#DC2626','#7C3AED','#0891B2'];
                    const cor  = t.cor || COLORS[idx % COLORS.length];
                    const mods = t.modulos?.length ?? 0;
                    const done = myProg.filter(p => p.trilhaId === t.id && p.concluido).length;
                    const p    = pct(done, mods);
                    const res  = myRes.filter(r => r.trailTitle === t.titulo);
                    const media = res.length ? Math.round(res.reduce((a, r) => a + r.nota, 0) / res.length) : null;
                    return (
                      <div key={t.id} className="border border-slate-200 rounded-[14px] p-5 hover:border-[#C9A84C]/50 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: cor + '20', color: cor }}>
                              {t.icone || '📚'}
                            </div>
                            <div>
                              <p className="text-sm font-black text-[#0A1628] leading-tight">{t.titulo}</p>
                              <p className="text-[10px] text-slate-500">{done}/{mods} módulos</p>
                            </div>
                          </div>
                          {p === 100
                            ? <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">✓ Concluída</span>
                            : <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-white text-[#C9A84C]">{p}%</span>
                          }
                        </div>
                        <div className="w-full bg-white rounded-full h-1.5 mb-2">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${p}%`, background: p === 100 ? '#059669' : cor }}></div>
                        </div>
                        {media !== null && (
                          <p className="text-[10px] text-slate-500 mt-1">Média nos testes: <strong style={{ color: media >= 75 ? '#059669' : '#dc2626' }}>{media}%</strong></p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── BADGES ────────────────────────────────────────────────── */}
          {tab === 'badges' && (
            <div className="p-5 space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{earnedBadges.length} de {totalBadges} badges conquistados</p>
                <div className="flex gap-2">
                  {Object.entries(NIVEL_CONFIG).reverse().map(([k, v]) => (
                    <span key={k} className="text-[9px] font-black px-2 py-1 rounded-lg" style={{ background: v.bg, color: v.color }}>{v.label}</span>
                  ))}
                </div>
              </div>
              {Object.entries(badgesByNivel).reverse().map(([nivel, badges]) => (
                <div key={nivel}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3"
                    style={{ color: NIVEL_CONFIG[nivel as keyof typeof NIVEL_CONFIG].color }}>
                    {NIVEL_CONFIG[nivel as keyof typeof NIVEL_CONFIG].label} — {badges.filter(b => b.check(badgeData)).length}/{badges.length}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {badges.map(b => <BadgeCard key={b.id} badge={b} earned={b.check(badgeData)} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── HISTÓRICO ─────────────────────────────────────────────── */}
          {tab === 'historico' && (
            <div className="p-5">
              {myRes.length === 0 ? (
                <div className="flex flex.col items-center justify-center py-16 text-slate-500">
                  <i className="fa-solid fa-clock-rotate-left text-4xl mb-3 opacity-30 block text-center"></i>
                  <p className="text-sm text-center">Nenhum teste realizado ainda.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myRes.map((r, i) => (
                    <div key={i} className="border border-slate-200 rounded-[12px] p-4 flex items-center gap-3 bg-white">
                      <i className={'fa-solid text-lg flex-shrink-0 ' + (r.aprovado ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-red-400')}></i>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#0A1628] truncate">{r.trailTitle}{r.moduleTitle ? ' · ' + r.moduleTitle : ''}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-slate-500">{formatDate(r.createdAt)}</p>
                          {r.ia && <span className="text-[9px] font-black bg-white text-[#C9A84C] px-1.5 py-0.5 rounded-lg">✨ IA</span>}
                          <span className={'text-[9px] font-black px-1.5 py-0.5 rounded-lg ' + (r.aprovado ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')}>
                            {r.aprovado ? 'Aprovado' : 'Reprovado'}
                          </span>
                        </div>
                      </div>
                      <span className={'text-sm font-black ' + (r.aprovado ? 'text-emerald-600' : 'text-red-500')}>{r.nota}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CERTIFICADOS ──────────────────────────────────────────── */}
          {tab === 'certificados' && (
            <div className="p-5">
              {myCerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <i className="fa-solid fa-certificate text-4xl mb-3 opacity-30"></i>
                  <p className="text-sm">Nenhum certificado emitido ainda.</p>
                  <p className="text-xs text-slate-500 mt-1">Conclua uma trilha para emitir seu certificado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myCerts.map((c, i) => (
                    <div key={i} className="border-2 border-amber-200 rounded-[14px] p-5 bg-gradient-to-br from-amber-50 to-yellow-50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                          <i className="fa-solid fa-certificate text-amber-600 text-lg"></i>
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#0A1628]">{c.trilhaTitulo}</p>
                          <p className="text-[10px] text-slate-500">{formatDate(c.emitidoEm)}</p>
                        </div>
                        <span className="ml-auto text-sm font-black text-amber-700">{c.notaFinal}%</span>
                      </div>
                      {c.codigoVerificacao && (
                        <p className="text-[9px] text-slate-500 font-mono bg-white/60 px-2 py-1 rounded-lg">
                          Cód: {c.codigoVerificacao}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeuProgressoView;
