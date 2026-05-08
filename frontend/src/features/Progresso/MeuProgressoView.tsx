import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const MeuProgressoView: React.FC = () => {
  const { state } = useApp();
  const user = state.user;

  const [trilhasProgresso, setTrilhasProgresso] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [videosAssistidos, setVideosAssistidos] = useState<any[]>([]);
  const [comunicadosLidos, setComunicadosLidos] = useState<any[]>([]);
  const [examesResultados, setExamesResultados] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const u1 = onSnapshot(query(collection(db, 'trilhasProgresso'), where('userId', '==', user.id)),
      s => setTrilhasProgresso(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, 'treinamentosQuizResults')),
      s => setQuizResults(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.colaborador === user.name || r.colaboradorId === user.id)));
    const u3 = onSnapshot(query(collection(db, 'videosProgresso'), where('userId', '==', user.id)),
      s => setVideosAssistidos(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.assistido)));
    const u4 = onSnapshot(query(collection(db, 'comunicadosLeituras'), where('userId', '==', user.id)),
      s => setComunicadosLidos(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u5 = onSnapshot(query(collection(db, 'examesResultados'), where('userId', '==', user.id)),
      s => setExamesResultados(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [user?.id, user?.name]);

  const stats = useMemo(() => {
    const trilhasConcluidas = trilhasProgresso.filter(t => t.concluida).length;
    const quizzesFelitos = quizResults.length;
    const aprovados = quizResults.filter(r => (r.score || 0) >= 70).length;
    const mediaScore = quizResults.length > 0
      ? Math.round(quizResults.reduce((acc, r) => acc + (r.score || 0), 0) / quizResults.length)
      : 0;
    const examesAprovados = examesResultados.filter(r => r.aprovado).length;
    const mediaExames = examesResultados.length > 0
      ? Math.round(examesResultados.reduce((acc, r) => acc + (r.score || 0), 0) / examesResultados.length)
      : 0;
    return { trilhasConcluidas, quizzesFelitos, aprovados, mediaScore, examesAprovados, mediaExames };
  }, [trilhasProgresso, quizResults, examesResultados]);

  const imprimirCertificado = (item: any, tipo: 'trilha' | 'quiz') => {
    const nome = user?.name || 'Colaborador';
    const titulo = item.trilhaTitulo || item.quizTitulo || item.titulo || 'Treinamento';
    const data = item.concluidoEm?.toDate?.()?.toLocaleDateString('pt-BR') || new Date().toLocaleDateString('pt-BR');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Certificado</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600;800&display=swap');
      body { margin: 0; font-family: 'Inter', sans-serif; background: #f8f6f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .cert { width: 900px; background: white; border: 12px solid #1e3a5f; padding: 60px 80px; text-align: center; position: relative; }
      .cert::before { content: ''; position: absolute; inset: 8px; border: 2px solid #c9a84c; pointer-events: none; }
      .logo { font-size: 13px; font-weight: 800; letter-spacing: 4px; color: #1e3a5f; text-transform: uppercase; margin-bottom: 30px; }
      .cert h1 { font-family: 'Playfair Display', serif; font-size: 42px; color: #1e3a5f; margin: 0 0 10px; }
      .cert .tipo { font-size: 11px; letter-spacing: 5px; text-transform: uppercase; color: #c9a84c; margin-bottom: 30px; font-weight: 600; }
      .cert .texto { font-size: 15px; color: #555; line-height: 1.8; margin-bottom: 10px; }
      .cert .nome { font-size: 32px; font-weight: 800; color: #1e3a5f; margin: 10px 0; font-style: italic; }
      .cert .curso { font-size: 20px; font-weight: 700; color: #1e3a5f; margin: 20px 0 10px; }
      .cert .data { font-size: 13px; color: #888; margin-top: 40px; }
      .cert .assinatura { margin-top: 50px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #888; display: inline-block; min-width: 200px; }
      @media print { body { background: white; } .cert { border: 12px solid #1e3a5f !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>
    <div class="cert">
      <div class="logo">MJ Consultoria · Plataforma de Treinamento Corporativo</div>
      <h1>Certificado de Conclusão</h1>
      <div class="tipo">${tipo === 'trilha' ? 'Trilha de Aprendizagem' : 'Avaliação'}</div>
      <p class="texto">Certificamos que</p>
      <p class="nome">${nome}</p>
      <p class="texto">concluiu com êxito</p>
      <p class="curso">${titulo}</p>
      ${stats.mediaScore > 0 ? `<p class="texto" style="font-size:13px;color:#888">Nota obtida: <strong>${stats.mediaScore}%</strong></p>` : ''}
      <p class="data">Emitido em ${data}</p>
      <div style="display:flex;justify-content:center;gap:80px;margin-top:50px">
        <div class="assinatura">MJ Consultoria<br>Coordenação de Treinamento</div>
      </div>
    </div></body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">
      <header>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Meu <span className="text-teal-500">Progresso</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
          {user?.name} · {user?.role}
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Trilhas Concluídas',  value: stats.trilhasConcluidas,  icon: 'fa-road',            color: 'teal'    },
          { label: 'Quizzes Realizados',  value: stats.quizzesFelitos,     icon: 'fa-circle-question',  color: 'blue'    },
          { label: 'Aprovações Quiz',     value: stats.aprovados,          icon: 'fa-trophy',           color: 'amber'   },
          { label: 'Média Quiz',          value: `${stats.mediaScore}%`,   icon: 'fa-chart-line',       color: 'emerald' },
          { label: 'Exames Aprovados',    value: stats.examesAprovados,    icon: 'fa-file-pen',         color: 'purple'  },
          { label: 'Média Exames',        value: `${stats.mediaExames}%`,  icon: 'fa-star',             color: 'pink'    },
        ].map((k, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-2">
            <i className={`fa-solid ${k.icon} text-${k.color}-500`}></i>
            <p className="text-3xl font-black text-white">{k.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trilhas */}
        <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4">
          <h3 className="text-white font-black uppercase text-sm flex items-center gap-2">
            <i className="fa-solid fa-road text-teal-400"></i>Minhas Trilhas
          </h3>
          {trilhasProgresso.length === 0 ? (
            <p className="text-slate-500 text-xs italic">Nenhuma trilha iniciada ainda.</p>
          ) : trilhasProgresso.map(t => (
            <div key={t.id} className="space-y-2 p-3 bg-slate-900/50 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white truncate">{t.trilhaTitulo || 'Trilha'}</span>
                {t.concluida ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-lg font-black uppercase">Concluída</span>
                    <button onClick={() => imprimirCertificado(t, 'trilha')}
                      className="text-[9px] bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-lg font-black uppercase tracking-widest transition-all">
                      <i className="fa-solid fa-certificate mr-1"></i>Certificado
                    </button>
                  </div>
                ) : (
                  <span className="text-[9px] text-teal-400 font-black">{Math.round((t.percentual || 0))}%</span>
                )}
              </div>
              {!t.concluida && (
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${t.percentual || 0}%` }}></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quizzes */}
        <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4">
          <h3 className="text-white font-black uppercase text-sm flex items-center gap-2">
            <i className="fa-solid fa-circle-question text-blue-400"></i>Histórico de Quizzes
          </h3>
          {quizResults.length === 0 ? (
            <p className="text-slate-500 text-xs italic">Nenhum quiz realizado ainda.</p>
          ) : quizResults.slice(0, 8).map(r => {
            const aprovado = (r.score || 0) >= 70;
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${aprovado ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  <i className={`fa-solid ${aprovado ? 'fa-check' : 'fa-xmark'} text-${aprovado ? 'emerald' : 'red'}-400 text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{r.quizTitulo || r.titulo || 'Quiz'}</p>
                  <p className="text-[9px] text-slate-500">{r.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || ''}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${aprovado ? 'text-emerald-400' : 'text-red-400'}`}>{r.score || 0}%</p>
                  {aprovado && (
                    <button onClick={() => imprimirCertificado(r, 'quiz')}
                      className="text-[8px] text-amber-400 hover:underline font-black uppercase">
                      Certificado
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Vídeos */}
        <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4">
          <h3 className="text-white font-black uppercase text-sm flex items-center gap-2">
            <i className="fa-brands fa-youtube text-red-400"></i>Vídeos Assistidos
            <span className="ml-auto text-[10px] text-slate-500">{videosAssistidos.length} vídeo(s)</span>
          </h3>
          {videosAssistidos.length === 0 ? (
            <p className="text-slate-500 text-xs italic">Nenhum vídeo assistido ainda.</p>
          ) : videosAssistidos.slice(0, 6).map(v => (
            <div key={v.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-play text-red-400 text-xs"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{v.videoTitulo || 'Vídeo'}</p>
                <p className="text-[9px] text-emerald-400 font-black uppercase"><i className="fa-solid fa-check mr-1"></i>Assistido</p>
              </div>
            </div>
          ))}
        </div>

        {/* Comunicados lidos */}
        <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4">
          <h3 className="text-white font-black uppercase text-sm flex items-center gap-2">
            <i className="fa-solid fa-bell text-amber-400"></i>Comunicados Lidos
            <span className="ml-auto text-[10px] text-slate-500">{comunicadosLidos.length} lido(s)</span>
          </h3>
          {comunicadosLidos.length === 0 ? (
            <p className="text-slate-500 text-xs italic">Nenhum comunicado lido ainda.</p>
          ) : (
            <p className="text-slate-400 text-sm">Você leu <span className="text-amber-400 font-black">{comunicadosLidos.length}</span> comunicado(s).</p>
          )}
        </div>
      </div>

      {/* Exames */}
      <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4">
        <h3 className="text-white font-black uppercase text-sm flex items-center gap-2">
          <i className="fa-solid fa-file-pen text-purple-400"></i>Histórico de Exames
          <span className="ml-auto text-[10px] text-slate-500">{examesResultados.length} realizado(s)</span>
        </h3>
        {examesResultados.length === 0 ? (
          <p className="text-slate-500 text-xs italic">Nenhum exame realizado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {examesResultados.slice(0, 8).map(r => {
              const aprovado = r.aprovado;
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${aprovado ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                    <i className={`fa-solid ${aprovado ? 'fa-trophy' : 'fa-xmark'} ${aprovado ? 'text-emerald-400' : 'text-red-400'} text-sm`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{r.fonteTitulo || 'Exame'}</p>
                    <p className="text-[9px] text-slate-500">{r.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || ''}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${aprovado ? 'text-emerald-400' : 'text-red-400'}`}>{r.score || 0}%</p>
                    <p className={`text-[9px] font-black uppercase ${aprovado ? 'text-emerald-500' : 'text-red-500'}`}>
                      {aprovado ? 'Aprovado' : 'Reprovado'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeuProgressoView;
