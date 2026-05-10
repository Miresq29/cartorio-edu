import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, where, addDoc, serverTimestamp, orderBy, Timestamp,
} from 'firebase/firestore';
import { GeminiService, QuestaoExame } from '../../services/geminiService';

/* ─── tipos ───────────────────────────────────────────────── */
type Fase = 'escolher' | 'gerando' | 'fazendo' | 'resultado';

interface QuizSalvo {
  id: string;
  titulo: string;
  treinamento: string;
  questoes: {
    id: string;
    texto: string;
    opcoes: string[];
    correta: number;
    explicacao: string;
  }[];
  geradoPorIA: boolean;
  createdAt?: any;
}

interface ExameResultado {
  id: string;
  userId: string;
  fonteId: string;
  fonteTitulo: string;
  score: number;
  aprovado: boolean;
  respostas: { questaoId: number; escolhida: string; correta: string }[];
  createdAt: any;
  proximaTentativa?: any;
}

/* ─── helpers ─────────────────────────────────────────────── */
const DIAS_BLOQUEIO = 5;
const NOTA_APROVACAO = 70;
const LETRAS = ['A', 'B', 'C', 'D', 'E'];

function diasRestantes(proximaTentativa: any): number {
  if (!proximaTentativa) return 0;
  const ms = proximaTentativa.toDate
    ? proximaTentativa.toDate().getTime() - Date.now()
    : new Date(proximaTentativa).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function quizToQuestoes(quiz: QuizSalvo): QuestaoExame[] {
  return quiz.questoes.map((q, idx) => ({
    id: idx + 1,
    enunciado: q.texto,
    alternativas: q.opcoes.map((o, i) => ({ letra: LETRAS[i] ?? String(i), texto: o })),
    correta: LETRAS[q.correta] ?? 'A',
    bloom: 'aplicacao' as const,
    justificativa: q.explicacao || '',
  }));
}

/* ═══════════════════════════════════════════════════════════ */
const ExamesView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const user = state.user!;

  const [quizzes, setQuizzes] = useState<QuizSalvo[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [resultados, setResultados] = useState<ExameResultado[]>([]);

  const [fase, setFase] = useState<Fase>('escolher');
  const [quizEscolhido, setQuizEscolhido] = useState<QuizSalvo | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoExame[]>([]);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [resultado, setResultado] = useState<{ score: number; aprovado: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);

  /* ── carrega quizzes do treinamento ─────────────────────── */
  useEffect(() => {
    const q = query(collection(db, 'treinamentosQuizzes'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizSalvo)));
      setLoadingQuizzes(false);
    });
  }, []);

  /* ── carrega resultados do usuário ─────────────────────── */
  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'examesResultados'), where('userId', '==', user.id));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExameResultado));
      docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setResultados(docs);
    });
  }, [user?.id]);

  const verificaBloqueio = useCallback((quizId: string) => {
    const ultimo = resultados.find(r => r.fonteId === quizId && !r.aprovado);
    if (!ultimo?.proximaTentativa) return null;
    const dias = diasRestantes(ultimo.proximaTentativa);
    return dias > 0 ? dias : null;
  }, [resultados]);

  const jaAprovado = useCallback((quizId: string) =>
    resultados.some(r => r.fonteId === quizId && r.aprovado),
  [resultados]);

  /* ── inicia exame com quiz salvo ────────────────────────── */
  const handleIniciarExame = (quiz: QuizSalvo) => {
    const bloqueio = verificaBloqueio(quiz.id);
    if (bloqueio) {
      showToast(`Disponível em ${bloqueio} dia(s).`, 'error');
      return;
    }
    if (!quiz.questoes || quiz.questoes.length === 0) {
      showToast('Este questionário não possui questões cadastradas.', 'error');
      return;
    }
    setQuizEscolhido(quiz);
    setQuestoes(quizToQuestoes(quiz));
    setRespostas({});
    setFase('fazendo');
  };

  /* ── submete respostas ─────────────────────────────────── */
  const handleSubmeter = async () => {
    if (Object.keys(respostas).length < questoes.length) {
      showToast('Responda todas as questões antes de enviar.', 'error');
      return;
    }
    let acertos = 0;
    const detalhes = questoes.map(q => {
      const escolhida = respostas[q.id] || '';
      if (escolhida === q.correta) acertos++;
      return { questaoId: q.id, escolhida, correta: q.correta };
    });
    const score = Math.round((acertos / questoes.length) * 100);
    const aprovado = score >= NOTA_APROVACAO;
    setResultado({ score, aprovado });
    setFase('resultado');

    setSalvando(true);
    try {
      const proximaTentativa = aprovado
        ? null
        : Timestamp.fromDate(new Date(Date.now() + DIAS_BLOQUEIO * 86_400_000));
      await addDoc(collection(db, 'examesResultados'), {
        userId: user.id,
        userName: user.name,
        tenantId: user.tenantId,
        fonteId: quizEscolhido!.id,
        fonteTitulo: quizEscolhido!.titulo,
        score,
        aprovado,
        respostas: detalhes,
        createdAt: serverTimestamp(),
        proximaTentativa,
      });
    } catch {
      showToast('Não foi possível salvar o resultado. Recarregue a página.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const imprimirCertificado = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const data = new Date().toLocaleDateString('pt-BR');
    win.document.write(`<!DOCTYPE html><html><head><title>Certificado</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600;800&display=swap');
      body { margin: 0; font-family: 'Inter', sans-serif; background: #f8f6f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .cert { width: 900px; background: white; border: 12px solid #1e3a5f; padding: 60px 80px; text-align: center; position: relative; }
      .cert::before { content: ''; position: absolute; inset: 8px; border: 2px solid #c9a84c; pointer-events: none; }
      .logo { font-size: 13px; font-weight: 800; letter-spacing: 4px; color: #1e3a5f; text-transform: uppercase; margin-bottom: 30px; }
      h1 { font-family: 'Playfair Display', serif; font-size: 42px; color: #1e3a5f; margin: 0 0 10px; }
      .tipo { font-size: 11px; letter-spacing: 5px; text-transform: uppercase; color: #c9a84c; margin-bottom: 30px; font-weight: 600; }
      .texto { font-size: 15px; color: #555; line-height: 1.8; }
      .nome { font-size: 32px; font-weight: 800; color: #1e3a5f; margin: 10px 0; font-style: italic; }
      .curso { font-size: 20px; font-weight: 700; color: #1e3a5f; margin: 20px 0 10px; }
      .data { font-size: 13px; color: #888; margin-top: 40px; }
      .assinatura { margin-top: 50px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #888; display: inline-block; min-width: 200px; }
      @media print { body { background: white; } .cert { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>
    <div class="cert">
      <div class="logo">MJ Consultoria · Plataforma de Treinamento Corporativo</div>
      <h1>Certificado de Conclusão</h1>
      <div class="tipo">Exame de Avaliação</div>
      <p class="texto">Certificamos que</p>
      <p class="nome">${user.name}</p>
      <p class="texto">foi aprovado(a) no exame de</p>
      <p class="curso">${quizEscolhido?.titulo || 'Treinamento'}</p>
      <p class="texto" style="font-size:13px;color:#888">Nota obtida: <strong>${resultado?.score}%</strong></p>
      <p class="data">Emitido em ${data}</p>
      <div style="display:flex;justify-content:center;gap:80px;margin-top:50px">
        <div class="assinatura">MJ Consultoria<br>Coordenação de Treinamento</div>
      </div>
    </div></body></html>`);
    win.document.close();
    win.print();
  };

  const totalRespondidas = Object.keys(respostas).length;
  const percentualFeito = questoes.length > 0
    ? Math.round((totalRespondidas / questoes.length) * 100)
    : 0;

  /* ─── FASE: fazendo ─────────────────────────────────────── */
  if (fase === 'fazendo') {
    return (
      <div className="p-6 md:p-8 min-h-screen bg-slate-50 space-y-6 animate-in fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#0D1B3E] uppercase tracking-tighter">
              Exame: <span className="text-blue-500">{quizEscolhido?.titulo}</span>
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
              {questoes.length} questões · Nota mínima {NOTA_APROVACAO}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-[#0A1628]">{totalRespondidas}<span className="text-slate-400">/{questoes.length}</span></p>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">Respondidas</p>
          </div>
        </div>

        <div className="w-full bg-slate-200 rounded-full h-2">
          {/* dynamic width requires inline style — Tailwind JIT cannot resolve runtime values */}
          <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${percentualFeito}%` }}></div>
        </div>

        <div className="space-y-5">
          {questoes.map((q, idx) => {
            const respondida = respostas[q.id];
            return (
              <div key={q.id}
                className={`bg-white border rounded-[20px] p-5 space-y-4 transition-all ${
                  respondida ? 'border-blue-500/40' : 'border-slate-200'
                }`}>
                <p className="text-sm font-bold text-[#0A1628] leading-relaxed">
                  <span className="text-slate-400 mr-2">{idx + 1}.</span>{q.enunciado}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {q.alternativas.map(alt => (
                    <button key={alt.letra} type="button"
                      onClick={() => setRespostas(prev => ({ ...prev, [q.id]: alt.letra }))}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        respondida === alt.letra
                          ? 'border-blue-500 bg-blue-50 text-[#0A1628]'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-[#0A1628]'
                      }`}>
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        respondida === alt.letra ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>{alt.letra}</span>
                      <span className="text-xs leading-snug">{alt.texto}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center pt-4 pb-8">
          <button type="button"
            onClick={handleSubmeter}
            disabled={totalRespondidas < questoes.length}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black uppercase tracking-widest rounded-2xl transition-all text-sm shadow-lg shadow-blue-900/20">
            <i className="fa-solid fa-paper-plane mr-2"></i>
            Enviar Exame
            {totalRespondidas < questoes.length && (
              <span className="ml-2 text-xs opacity-70">({questoes.length - totalRespondidas} restantes)</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ─── FASE: resultado ───────────────────────────────────── */
  if (fase === 'resultado' && resultado) {
    const { score, aprovado } = resultado;
    return (
      <div className="p-8 min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 animate-in fade-in">
        <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-lg ${
          aprovado ? 'bg-emerald-100 shadow-emerald-200' : 'bg-red-100 shadow-red-200'
        }`}>
          <i className={`fa-solid ${aprovado ? 'fa-trophy' : 'fa-xmark'} text-4xl ${aprovado ? 'text-emerald-500' : 'text-red-500'}`}></i>
        </div>

        <div className="text-center space-y-2">
          <p className={`text-5xl font-black ${aprovado ? 'text-emerald-500' : 'text-red-500'}`}>{score}%</p>
          <p className="text-xl font-black text-[#0A1628] uppercase tracking-widest">
            {aprovado ? 'Aprovado!' : 'Reprovado'}
          </p>
          <p className="text-slate-500 text-sm max-w-sm">
            {aprovado
              ? `Parabéns! Você atingiu a nota mínima de ${NOTA_APROVACAO}%.`
              : `Nota mínima: ${NOTA_APROVACAO}%. Você poderá tentar novamente em ${DIAS_BLOQUEIO} dias.`
            }
          </p>
        </div>

        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[24px] p-6 space-y-3">
          <h3 className="text-[#0A1628] font-black uppercase text-sm">Gabarito</h3>
          <div className="space-y-2">
            {questoes.map((q, idx) => {
              const escolhida = respostas[q.id] || '';
              const acertou = escolhida === q.correta;
              return (
                <div key={q.id} className={`p-3 rounded-xl border ${
                  acertou ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-start gap-2">
                    <i className={`fa-solid ${acertou ? 'fa-check' : 'fa-xmark'} ${acertou ? 'text-emerald-500' : 'text-red-500'} text-xs mt-1 flex-shrink-0`}></i>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#0A1628] leading-snug">{idx + 1}. {q.enunciado.substring(0, 80)}{q.enunciado.length > 80 ? '...' : ''}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Sua resposta: <span className={acertou ? 'text-emerald-600' : 'text-red-500'}>{escolhida}</span>
                        {!acertou && <span className="text-emerald-600 ml-2">· Correta: {q.correta}</span>}
                      </p>
                      {!acertou && q.justificativa && (
                        <p className="text-[10px] text-slate-500 mt-1 italic">{q.justificativa}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {aprovado && (
            <button type="button" onClick={imprimirCertificado}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-black uppercase tracking-widest rounded-xl transition-all text-sm">
              <i className="fa-solid fa-certificate mr-2"></i>Emitir Certificado
            </button>
          )}
          <button type="button" onClick={() => { setFase('escolher'); setQuizEscolhido(null); setResultado(null); }}
            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-[#0A1628] font-black uppercase tracking-widest rounded-xl transition-all text-sm">
            <i className="fa-solid fa-arrow-left mr-2"></i>Voltar
          </button>
        </div>

        {salvando && <p className="text-slate-500 text-xs">Salvando resultado...</p>}
      </div>
    );
  }

  /* ─── FASE: escolher ────────────────────────────────────── */
  return (
    <div className="p-6 md:p-8 min-h-screen bg-slate-50 space-y-6 animate-in fade-in">
      <header>
        <h2 className="text-3xl font-black text-[#0D1B3E] italic uppercase tracking-tighter">
          Exames <span className="text-blue-500">de Avaliação</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
          Questionários definidos no módulo de Treinamento
        </p>
      </header>

      {/* info bloom */}
      <div className="bg-white border border-slate-200 rounded-[20px] p-5 grid grid-cols-3 gap-4">
        {[
          { label: 'Compreensão', pct: '30%', color: 'blue',    desc: 'Identificar e descrever conceitos' },
          { label: 'Aplicação',   pct: '40%', color: 'emerald', desc: 'Utilizar e demonstrar na prática'  },
          { label: 'Análise',     pct: '30%', color: 'purple',  desc: 'Comparar, examinar e avaliar'      },
        ].map(b => (
          <div key={b.label} className="text-center space-y-1">
            <span className={`text-xs font-black uppercase text-${b.color}-600`}>{b.label}</span>
            <p className={`text-2xl font-black text-${b.color}-500`}>{b.pct}</p>
            <p className="text-[9px] text-slate-500">{b.desc}</p>
          </div>
        ))}
      </div>

      {/* lista de quizzes */}
      <div>
        <h3 className="text-[#0A1628] font-black uppercase text-sm mb-4">
          <i className="fa-solid fa-list-check text-blue-500 mr-2"></i>
          Questionários disponíveis
        </h3>

        {loadingQuizzes ? (
          <div className="text-slate-500 text-sm italic">Carregando questionários...</div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[20px] p-8 text-center space-y-3">
            <i className="fa-solid fa-circle-question text-4xl text-slate-300"></i>
            <p className="text-slate-500 text-sm font-semibold">Nenhum questionário cadastrado.</p>
            <p className="text-slate-400 text-xs">
              Acesse <strong>Treinamento → Questionários</strong> para criar os exames da sua equipe.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map(quiz => {
              const bloqueio = verificaBloqueio(quiz.id);
              const aprovado = jaAprovado(quiz.id);
              const ultimoResult = resultados.find(r => r.fonteId === quiz.id);
              const selecionado = quizEscolhido?.id === quiz.id;

              return (
                <div key={quiz.id}
                  className={`bg-white border rounded-[20px] p-5 space-y-3 transition-all ${
                    bloqueio
                      ? 'border-slate-200 opacity-60 cursor-not-allowed'
                      : selecionado
                        ? 'border-blue-500 shadow-md shadow-blue-100'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-sm cursor-pointer'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      quiz.geradoPorIA ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      <i className={`fa-solid ${quiz.geradoPorIA ? 'fa-robot' : 'fa-file-pen'} text-sm ${
                        quiz.geradoPorIA ? 'text-purple-600' : 'text-blue-600'
                      }`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-[#0A1628] truncate">{quiz.titulo}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">
                        {quiz.treinamento} · {quiz.questoes?.length || 0} questões
                      </p>
                    </div>
                    {quiz.geradoPorIA && (
                      <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-black flex-shrink-0">IA</span>
                    )}
                  </div>

                  {bloqueio ? (
                    <div className="flex items-center gap-2 text-[10px] text-red-500 font-black">
                      <i className="fa-solid fa-lock"></i>
                      Disponível em {bloqueio} dia(s)
                    </div>
                  ) : aprovado ? (
                    <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-black">
                      <i className="fa-solid fa-trophy"></i>
                      Aprovado · {ultimoResult?.score}%
                    </div>
                  ) : ultimoResult && !ultimoResult.aprovado ? (
                    <div className="flex items-center gap-2 text-[10px] text-amber-600 font-black">
                      <i className="fa-solid fa-rotate-right"></i>
                      Última tentativa: {ultimoResult.score}% · Refazer disponível
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 font-bold">
                      <i className="fa-solid fa-play mr-1 text-blue-400"></i>Disponível
                    </div>
                  )}

                  {!bloqueio && (
                    <button type="button"
                      onClick={() => handleIniciarExame(quiz)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all">
                      <i className="fa-solid fa-play mr-2"></i>
                      {aprovado ? 'Refazer Exame' : 'Iniciar Exame'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* histórico pessoal */}
      {resultados.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4">
          <h3 className="text-[#0A1628] font-black uppercase text-sm flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-slate-400"></i>
            Meu Histórico de Exames
          </h3>
          <div className="space-y-2">
            {resultados.slice(0, 10).map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${r.aprovado ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  <i className={`fa-solid ${r.aprovado ? 'fa-trophy' : 'fa-xmark'} ${r.aprovado ? 'text-emerald-600' : 'text-red-500'} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#0A1628] truncate">{r.fonteTitulo}</p>
                  <p className="text-[9px] text-slate-500">{r.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || ''}</p>
                </div>
                <p className={`text-sm font-black ${r.aprovado ? 'text-emerald-600' : 'text-red-500'}`}>{r.score}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamesView;
