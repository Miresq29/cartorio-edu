import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useApp } from '../../context/AppContext';

// ─── Types ─────────────────────────────────────────────────────────────────

interface QuizResult {
  id: string;
  quizId: string;
  quizTitulo: string;
  treinamento: string;
  colaborador: string;
  cargo: string;
  nota: number;
  total: number;
  aprovado: boolean;
  respostas: number[];
  createdAt?: any;
}

interface Quiz {
  id: string;
  titulo: string;
  treinamento: string;
  questoes: { id: string; texto: string; opcoes: string[]; correta: number }[];
}

interface TrilhaProgresso {
  id: string;
  userId: string;
  userName: string;
  trilhaId: string;
  trilhaTitulo: string;
  percentualObrigatorios: number;
  concluida: boolean;
  tenantId: string;
}

interface Trilha {
  id: string;
  titulo: string;
  perfis: string[];
  modulos: { id: string; titulo: string; tipo: string }[];
  ativa: boolean;
  tenantId: string;
}

interface AppUser {
  id: string;
  name: string;
  role: string;
  tenantId: string;
  active: boolean;
}

interface QuestaoMetric {
  quizId: string;
  quizTitulo: string;
  treinamento: string;
  questaoIdx: number;
  texto: string;
  totalTentativas: number;
  erros: number;
  taxaErro: number;
}

type DashTab = 'visao-geral' | 'cobertura' | 'dificuldade' | 'ranking';

const DASH_TABS = [
  { id: 'visao-geral' as DashTab, icon: 'fa-chart-pie',       label: 'Visão Geral'   },
  { id: 'cobertura'  as DashTab, icon: 'fa-users-line',       label: 'Cobertura'     },
  { id: 'dificuldade' as DashTab, icon: 'fa-triangle-exclamation', label: 'Dificuldade'  },
  { id: 'ranking'    as DashTab, icon: 'fa-ranking-star',     label: 'Ranking'       },
];

// ─── Certificate Generator ──────────────────────────────────────────────────

const printTrilhaCertificate = (userName: string, cargo: string, trilhaTitulo: string, nota?: number) => {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Certificado — ${userName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc}
    .cert{border:8px double #1e3a8a;padding:60px;text-align:center;max-width:720px;background:white;position:relative}
    .corner{position:absolute;width:40px;height:40px;border-color:#1e3a8a;border-style:solid}
    .tl{top:12px;left:12px;border-width:3px 0 0 3px}
    .tr{top:12px;right:12px;border-width:3px 3px 0 0}
    .bl{bottom:12px;left:12px;border-width:0 0 3px 3px}
    .br{bottom:12px;right:12px;border-width:0 3px 3px 0}
    .org{font-size:13px;letter-spacing:5px;text-transform:uppercase;color:#1e3a8a;font-family:Arial;margin-bottom:4px}
    .subtitle{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9ca3af;margin-bottom:36px;font-family:Arial}
    .cert-title{font-size:14px;letter-spacing:6px;text-transform:uppercase;color:#374151;margin-bottom:24px;font-family:Arial}
    .label{font-size:11px;color:#9ca3af;margin-bottom:12px;font-family:Arial}
    .name{font-size:34px;font-weight:bold;color:#111;border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:6px;display:inline-block;min-width:320px}
    .role{font-size:12px;color:#9ca3af;margin-bottom:28px;font-family:Arial}
    .trail-label{font-size:11px;color:#9ca3af;margin-bottom:8px;font-family:Arial}
    .trail{font-size:24px;font-weight:bold;color:#1e3a8a;margin-bottom:8px}
    .date{font-size:11px;color:#9ca3af;margin-bottom:36px;font-family:Arial}
    .badge{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 24px;display:inline-block;margin-bottom:44px;font-family:Arial;font-size:11px;color:#16a34a}
    .sigs{display:flex;justify-content:space-around;margin-top:36px;border-top:1px solid #e5e7eb;padding-top:28px}
    .sig{border-top:1px solid #374151;width:180px;padding-top:8px;font-size:10px;color:#9ca3af;font-family:Arial;text-align:center}
    .footer{font-size:9px;color:#d1d5db;margin-top:24px;font-family:Arial}
    @media print{body{background:white}}
  </style></head><body>
  <div class="cert">
    <div class="corner tl"></div><div class="corner tr"></div>
    <div class="corner bl"></div><div class="corner br"></div>
    <div class="org">MJ Consultoria</div>
    <div class="subtitle">Gestão do Conhecimento Notarial</div>
    <div class="cert-title">Certificado de Conclusão de Trilha</div>
    <div class="label">Certificamos que</div>
    <div class="name">${userName}</div>
    ${cargo ? `<div class="role">${cargo}</div>` : '<div style="margin-bottom:28px"></div>'}
    <div class="trail-label">concluiu com êxito a Trilha de Aprendizagem</div>
    <div class="trail">${trilhaTitulo}</div>
    <div class="date">em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    ${nota !== undefined ? `<div class="badge">Nota média: <strong>${nota}%</strong> — ✓ Aprovado</div>` : ''}
    <div class="sigs">
      <div class="sig">Responsável pela Trilha</div>
      <div class="sig">MJ Consultoria</div>
    </div>
    <div class="footer">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
  </div>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
  </body></html>`);
  win.document.close();
};

// ─── Main Component ─────────────────────────────────────────────────────────

const TrainingDashboard: React.FC = () => {
  const { state } = useApp();

  const [activeTab, setActiveTab] = useState<DashTab>('visao-geral');
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [trilhasProgresso, setTrilhasProgresso] = useState<TrilhaProgresso[]>([]);
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, 'treinamentosQuizResults'), orderBy('createdAt', 'desc')),
        s => setQuizResults(s.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult)))),
      onSnapshot(query(collection(db, 'treinamentosQuizzes'), orderBy('createdAt', 'desc')),
        s => setQuizzes(s.docs.map(d => ({ id: d.id, ...d.data() } as Quiz)))),
      onSnapshot(query(collection(db, 'trilhasProgresso')),
        s => setTrilhasProgresso(s.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaProgresso)))),
      onSnapshot(query(collection(db, 'trilhas')),
        s => setTrilhas(s.docs.map(d => ({ id: d.id, ...d.data() } as Trilha)))),
      onSnapshot(query(collection(db, 'users')),
        s => setAppUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // ── KPIs ────────────────────────────────────────────────────────────────

  const tenantId = state.user?.tenantId || '';
  const isSuperAdmin = state.user?.role === 'SUPERADMIN';

  const users = isSuperAdmin
    ? appUsers.filter(u => u.active)
    : appUsers.filter(u => u.active && (u.tenantId === tenantId || !u.tenantId));

  const progressoDoTenant = isSuperAdmin
    ? trilhasProgresso
    : trilhasProgresso.filter(p => p.tenantId === tenantId);

  const trilhasDoTenant = isSuperAdmin
    ? trilhas.filter(t => t.ativa)
    : trilhas.filter(t => t.ativa && t.tenantId === tenantId);

  const usuariosComTrilha = new Set(progressoDoTenant.map(p => p.userId)).size;
  const trilhasConcluidas = progressoDoTenant.filter(p => p.concluida).length;
  const totalQuizResults = quizResults.length;
  const aprovados = quizResults.filter(r => r.aprovado).length;
  const mediaGeral = quizResults.length > 0
    ? Math.round(quizResults.reduce((a, r) => a + r.nota, 0) / quizResults.length)
    : 0;

  // ── Cobertura por trilha ─────────────────────────────────────────────────

  const coberturaData = useMemo(() => {
    return trilhasDoTenant.map(trilha => {
      // Usuários que deveriam fazer (baseado nos perfis)
      const perfisAtivos = trilha.perfis || [];
      const elegíveis = users.filter(u => perfisAtivos.includes(u.role) || perfisAtivos.length === 0).length;
      const iniciaram = progressoDoTenant.filter(p => p.trilhaId === trilha.id).length;
      const concluiram = progressoDoTenant.filter(p => p.trilhaId === trilha.id && p.concluida).length;
      const pct = elegíveis > 0 ? Math.round((concluiram / elegíveis) * 100) : 0;
      return { trilha, elegíveis, iniciaram, concluiram, pct };
    });
  }, [trilhasDoTenant, users, progressoDoTenant]);

  // ── Dificuldade por questão ──────────────────────────────────────────────

  const questaoMetrics = useMemo((): QuestaoMetric[] => {
    const metrics: QuestaoMetric[] = [];

    quizzes.forEach(quiz => {
      const resultadosDoQuiz = quizResults.filter(r => r.quizId === quiz.id);
      if (resultadosDoQuiz.length === 0) return;

      quiz.questoes?.forEach((q, idx) => {
        const tentativas = resultadosDoQuiz.filter(r => r.respostas && r.respostas[idx] !== undefined).length;
        if (tentativas === 0) return;
        const erros = resultadosDoQuiz.filter(r => r.respostas && r.respostas[idx] !== q.correta).length;
        const taxaErro = Math.round((erros / tentativas) * 100);
        metrics.push({
          quizId: quiz.id,
          quizTitulo: quiz.titulo,
          treinamento: quiz.treinamento,
          questaoIdx: idx,
          texto: q.texto,
          totalTentativas: tentativas,
          erros,
          taxaErro,
        });
      });
    });

    return metrics.sort((a, b) => b.taxaErro - a.taxaErro);
  }, [quizzes, quizResults]);

  // ── Ranking de colaboradores ─────────────────────────────────────────────

  const ranking = useMemo(() => {
    const byUser: Record<string, { nome: string; cargo: string; quizzes: number; aprovados: number; notas: number[] }> = {};

    quizResults.forEach(r => {
      if (!byUser[r.colaborador]) {
        byUser[r.colaborador] = { nome: r.colaborador, cargo: r.cargo || '', quizzes: 0, aprovados: 0, notas: [] };
      }
      byUser[r.colaborador].quizzes++;
      if (r.aprovado) byUser[r.colaborador].aprovados++;
      byUser[r.colaborador].notas.push(r.nota);
    });

    return Object.values(byUser)
      .map(u => ({
        ...u,
        media: u.notas.length > 0 ? Math.round(u.notas.reduce((a, b) => a + b, 0) / u.notas.length) : 0,
        trilhasConcluidas: progressoDoTenant.filter(p => p.userName === u.nome && p.concluida).length,
      }))
      .sort((a, b) => b.media - a.media);
  }, [quizResults, progressoDoTenant]);

  // ── Difficulty color helper ──────────────────────────────────────────────

  const diffColor = (taxa: number) => {
    if (taxa >= 70) return { bar: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/10 border-red-500/30' };
    if (taxa >= 40) return { bar: 'bg-amber-500', text: 'text-amber-400', badge: 'bg-amber-500/10 border-amber-500/30' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/30' };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const renderVisaoGeral = () => (
    <div className="space-y-6">

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Colaboradores Ativos', value: users.length,           icon: 'fa-users',         color: 'blue'    },
          { label: 'Com Trilha Iniciada',  value: usuariosComTrilha,       icon: 'fa-road',          color: 'purple'  },
          { label: 'Trilhas Concluídas',   value: trilhasConcluidas,       icon: 'fa-circle-check',  color: 'emerald' },
          { label: 'Média Geral Provas',   value: `${mediaGeral}%`,        icon: 'fa-chart-line',    color: 'amber'   },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-3">
            <i className={`fa-solid ${kpi.icon} text-${kpi.color}-500 text-xl`}></i>
            <p className="text-3xl font-black text-[#0A1628]">{kpi.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Cobertura geral rápida */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Funcionários x Trilhas */}
        <div className="bg-[#0D1B3E] border border-slate-200 rounded-2xl p-5 space-y-4">
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Funcionários × Trilhas
          </h4>
          {trilhasDoTenant.length === 0 ? (
            <p className="text-xs text-slate-600 italic">Nenhuma trilha ativa cadastrada.</p>
          ) : (
            trilhasDoTenant.slice(0, 5).map(trilha => {
              const cobertura = coberturaData.find(c => c.trilha.id === trilha.id);
              if (!cobertura) return null;
              return (
                <div key={trilha.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-700 truncate max-w-[60%]">{trilha.titulo}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500">{cobertura.concluiram}/{cobertura.elegíveis}</span>
                      <span className={`text-[9px] font-black ${cobertura.pct >= 80 ? 'text-emerald-400' : cobertura.pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {cobertura.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${cobertura.pct >= 80 ? 'bg-emerald-500' : cobertura.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${cobertura.pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Top Questões Difíceis */}
        <div className="bg-[#0D1B3E] border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Top 5 Questões Mais Difíceis
          </h4>
          {questaoMetrics.length === 0 ? (
            <p className="text-xs text-slate-600 italic">Nenhuma tentativa registrada ainda.</p>
          ) : (
            questaoMetrics.slice(0, 5).map((m, i) => {
              const dc = diffColor(m.taxaErro);
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className={`text-lg font-black ${dc.text} flex-shrink-0 w-6 text-center`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 truncate">{m.texto}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">{m.treinamento} · {m.totalTentativas} tentativas</p>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg border flex-shrink-0 ${dc.badge} ${dc.text}`}>
                    {m.taxaErro}% erros
                  </span>
                </div>
              );
            })
          )}
          {questaoMetrics.length > 5 && (
            <button type="button" onClick={() => setActiveTab('dificuldade')}
              className="text-[9px] text-blue-400 hover:text-blue-300 font-black uppercase tracking-widest transition-colors">
              Ver todas →
            </button>
          )}
        </div>
      </div>

      {/* Taxa de aprovação por treinamento */}
      <div className="bg-[#0D1B3E] border border-slate-200 rounded-2xl p-5 space-y-4">
        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
          Taxa de Aprovação por Treinamento
        </h4>
        {(() => {
          const treinamentosUnicos = [...new Set(quizResults.map(r => r.treinamento))];
          if (treinamentosUnicos.length === 0) return <p className="text-xs text-slate-600 italic">Nenhum resultado ainda.</p>;
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {treinamentosUnicos.map(t => {
                const resultados = quizResults.filter(r => r.treinamento === t);
                const aprov = resultados.filter(r => r.aprovado).length;
                const taxa = Math.round((aprov / resultados.length) * 100);
                const media = Math.round(resultados.reduce((a, r) => a + r.nota, 0) / resultados.length);
                return (
                  <div key={t} className="bg-slate-900/50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-black text-[#0A1628] truncate">{t}</p>
                    <div className="flex gap-3">
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase tracking-widest">Aprovação</p>
                        <p className={`text-lg font-black ${taxa >= 70 ? 'text-emerald-400' : taxa >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{taxa}%</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase tracking-widest">Média</p>
                        <p className="text-lg font-black text-[#0A1628]">{media}%</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase tracking-widest">Provas</p>
                        <p className="text-lg font-black text-slate-700">{resultados.length}</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div className={`h-1 rounded-full ${taxa >= 70 ? 'bg-emerald-500' : taxa >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${taxa}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );

  const renderCobertura = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-[#0A1628] font-black uppercase italic text-sm">Cobertura de Trilhas</h3>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
          Funcionários elegíveis × Concluintes por trilha
        </p>
      </div>

      {coberturaData.length === 0 ? (
        <div className="bg-[#0D1B3E] border border-slate-200 rounded-2xl p-10 text-center">
          <i className="fa-solid fa-road text-4xl text-slate-700 mb-3 block"></i>
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Nenhuma trilha ativa</p>
        </div>
      ) : (
        <div className="space-y-4">
          {coberturaData.map(({ trilha, elegíveis, iniciaram, concluiram, pct }) => (
            <div key={trilha.id} className="bg-[#0D1B3E] border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-[#0A1628]">{trilha.titulo}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(trilha.perfis || []).map(p => (
                      <span key={p} className="text-[8px] font-black uppercase tracking-widest bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md">{p}</span>
                    ))}
                  </div>
                </div>
                <span className={`text-2xl font-black flex-shrink-0 ${pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {pct}%
                </span>
              </div>

              {/* Barra de progresso */}
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                ></div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Elegíveis', value: elegíveis, color: 'blue', icon: 'fa-users' },
                  { label: 'Iniciaram', value: iniciaram, color: 'amber', icon: 'fa-play' },
                  { label: 'Concluíram', value: concluiram, color: 'emerald', icon: 'fa-circle-check' },
                ].map((s, i) => (
                  <div key={i} className="bg-slate-900/50 rounded-xl p-3 text-center">
                    <i className={`fa-solid ${s.icon} text-${s.color}-400 text-sm mb-1 block`}></i>
                    <p className="text-xl font-black text-[#0A1628]">{s.value}</p>
                    <p className="text-[8px] text-slate-500 uppercase tracking-widest">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Usuários que concluíram */}
              {progressoDoTenant.filter(p => p.trilhaId === trilha.id && p.concluida).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Concluintes</p>
                  <div className="flex flex-wrap gap-2">
                    {progressoDoTenant
                      .filter(p => p.trilhaId === trilha.id && p.concluida)
                      .map((p, i) => {
                        const userInfo = appUsers.find(u => u.id === p.userId);
                        return (
                          <div key={i} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-[9px] font-black text-emerald-400">
                              {p.userName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#0A1628]">{p.userName}</p>
                              {userInfo?.role && <p className="text-[8px] text-slate-500">{userInfo.role}</p>}
                            </div>
                            <button
                              type="button"
                              title="Emitir certificado"
                              onClick={() => printTrilhaCertificate(p.userName, userInfo?.role || '', trilha.titulo)}
                              className="ml-1 text-[8px] font-black uppercase bg-emerald-600 hover:bg-emerald-500 text-[#0A1628] px-2 py-1 rounded-lg transition-all"
                            >
                              <i className="fa-solid fa-certificate mr-1"></i>Cert.
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDificuldade = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-[#0A1628] font-black uppercase italic text-sm">Assuntos com Maior Dificuldade</h3>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
          Questões com maior taxa de erro nas avaliações
        </p>
      </div>

      {questaoMetrics.length === 0 ? (
        <div className="bg-[#0D1B3E] border border-slate-200 rounded-2xl p-10 text-center">
          <i className="fa-solid fa-triangle-exclamation text-4xl text-slate-700 mb-3 block"></i>
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Nenhuma tentativa registrada ainda</p>
          <p className="text-slate-700 text-xs mt-1">As métricas aparecerão após os colaboradores realizarem as avaliações</p>
        </div>
      ) : (
        <>
          {/* Legenda */}
          <div className="flex flex-wrap gap-3">
            {[
              { color: 'bg-red-500',     label: 'Alta dificuldade ≥ 70% erros',   text: 'text-red-400'     },
              { color: 'bg-amber-500',   label: 'Média dificuldade 40-69% erros', text: 'text-amber-400'   },
              { color: 'bg-emerald-500', label: 'Baixa dificuldade < 40% erros',  text: 'text-emerald-400' },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${l.color}`}></div>
                <span className={`text-[9px] font-bold ${l.text}`}>{l.label}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {questaoMetrics.map((m, i) => {
              const dc = diffColor(m.taxaErro);
              return (
                <div key={i} className={`bg-[#0D1B3E] border rounded-2xl p-5 space-y-3 ${dc.badge}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.taxaErro >= 70 ? 'bg-red-500/20' : m.taxaErro >= 40 ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                      <span className={`text-lg font-black ${dc.text}`}>{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#0A1628] leading-relaxed">{m.texto}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="text-[9px] text-slate-500">
                          <i className="fa-solid fa-graduation-cap text-blue-500 mr-1"></i>{m.treinamento}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          <i className="fa-solid fa-clipboard-question mr-1"></i>{m.quizTitulo}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          <i className="fa-solid fa-users mr-1"></i>{m.totalTentativas} tentativas
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-2xl font-black ${dc.text}`}>{m.taxaErro}%</p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest">taxa de erro</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{m.erros} de {m.totalTentativas}</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${m.taxaErro >= 70 ? 'bg-red-500' : m.taxaErro >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${m.taxaErro}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  const renderRanking = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-[#0A1628] font-black uppercase italic text-sm">Ranking de Desempenho</h3>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Colaboradores ordenados por nota média</p>
      </div>

      {ranking.length === 0 ? (
        <div className="bg-[#0D1B3E] border border-slate-200 rounded-2xl p-10 text-center">
          <i className="fa-solid fa-ranking-star text-4xl text-slate-700 mb-3 block"></i>
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Nenhum resultado de avaliação ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((user, i) => {
            const medalColor = i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-700' : i === 2 ? 'text-amber-700' : 'text-slate-600';
            const medalIcon = i === 0 ? 'fa-trophy' : i === 1 ? 'fa-medal' : i === 2 ? 'fa-medal' : 'fa-hashtag';
            const scoreColor = user.media >= 80 ? 'text-emerald-400' : user.media >= 70 ? 'text-amber-400' : 'text-red-400';
            return (
              <div key={user.nome} className="bg-[#0D1B3E] border border-slate-200 hover:border-slate-200 rounded-2xl p-4 flex items-center gap-4 transition-all group">
                {/* Posição */}
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <i className={`fa-solid ${medalIcon} text-xl ${medalColor}`}></i>
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-[#0A1628]">{user.nome.charAt(0).toUpperCase()}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-[#0A1628]">{user.nome}</span>
                    {user.cargo && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md">
                        {user.cargo}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-[9px] text-slate-500">
                      <i className="fa-solid fa-clipboard-question mr-1"></i>{user.quizzes} avaliações
                    </span>
                    <span className="text-[9px] text-slate-500">
                      <i className="fa-solid fa-circle-check text-emerald-500 mr-1"></i>{user.aprovados} aprovadas
                    </span>
                    {user.trilhasConcluidas > 0 && (
                      <span className="text-[9px] text-emerald-400">
                        <i className="fa-solid fa-road mr-1"></i>{user.trilhasConcluidas} trilha{user.trilhasConcluidas > 1 ? 's' : ''} concluída{user.trilhasConcluidas > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Nota média */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-2xl font-black ${scoreColor}`}>{user.media}%</p>
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest">nota média</p>
                </div>

                {/* Certificado */}
                {user.trilhasConcluidas > 0 && (
                  <button
                    type="button"
                    title="Emitir certificado"
                    onClick={() => {
                      const trilhaConcluida = progressoDoTenant.find(p => p.userName === user.nome && p.concluida);
                      if (trilhaConcluida) {
                        printTrilhaCertificate(user.nome, user.cargo, trilhaConcluida.trilhaTitulo, user.media);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 bg-blue-600 hover:bg-blue-500 text-[#0A1628] px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-certificate text-xs"></i>Cert.
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[#0A1628] font-black uppercase italic text-sm">Dashboard de Gestão</h3>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
          Métricas de desempenho, cobertura de trilhas e dificuldade
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-2xl border border-slate-200 w-fit overflow-x-auto">
        {DASH_TABS.map(tab => (
          <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-blue-600 text-[#0A1628] shadow-lg shadow-blue-900/30' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <i className={`fa-solid ${tab.icon} text-xs`}></i>{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'visao-geral'  && renderVisaoGeral()}
      {activeTab === 'cobertura'    && renderCobertura()}
      {activeTab === 'dificuldade'  && renderDificuldade()}
      {activeTab === 'ranking'      && renderRanking()}
    </div>
  );
};

export default TrainingDashboard;
