import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, where, addDoc, serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { GeminiService, QuestaoExame } from '../../services/geminiService';

/* ─── tipos internos ──────────────────────────────────────── */
type Fase = 'escolher' | 'gerando' | 'fazendo' | 'resultado';

interface FonteConteudo {
  id: string;
  titulo: string;
  conteudo: string;
  tipo: 'treinamento' | 'knowledgeBase' | 'video' | 'checklist';
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

/* ─── helpers ────────────────────────────────────────────── */
const DIAS_BLOQUEIO = 5;
const NOTA_APROVACAO = 70;

function diasRestantes(proximaTentativa: any): number {
  if (!proximaTentativa) return 0;
  const ms = proximaTentativa.toDate
    ? proximaTentativa.toDate().getTime() - Date.now()
    : new Date(proximaTentativa).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function bloomLabel(bloom: string) {
  if (bloom === 'compreensao') return { label: 'Compreensão', color: 'blue' };
  if (bloom === 'aplicacao')   return { label: 'Aplicação',   color: 'emerald' };
  return                              { label: 'Análise',     color: 'purple' };
}

/* ══════════════════════════════════════════════════════════ */
const ExamesView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const user = state.user!;

  /* fontes de conteúdo */
  const [fontes, setFontes] = useState<FonteConteudo[]>([]);
  const [loadingFontes, setLoadingFontes] = useState(true);

  /* resultados anteriores do usuário */
  const [resultados, setResultados] = useState<ExameResultado[]>([]);

  /* estado do exame */
  const [fase, setFase] = useState<Fase>('escolher');
  const [fonteEscolhida, setFonteEscolhida] = useState<FonteConteudo | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoExame[]>([]);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [resultado, setResultado] = useState<{ score: number; aprovado: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);

  /* ── carrega fontes de conteúdo ─────────────────────────── */
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    const allFontes: FonteConteudo[] = [];

    const carrega = (colecao: string, tipo: FonteConteudo['tipo'], campoConteudo: string, campoTitulo: string) => {
      const u = onSnapshot(collection(db, colecao), snap => {
        const novos = snap.docs.map(d => ({
          id: d.id,
          titulo: d.data()[campoTitulo] || d.data()['title'] || d.data()['nome'] || 'Sem título',
          conteudo: d.data()[campoConteudo] || d.data()['content'] || d.data()['rawText'] || d.data()['descricao'] || '',
          tipo,
        }));
        // substitui as fontes desse tipo
        const filtered = allFontes.filter(f => f.tipo !== tipo);
        allFontes.splice(0, allFontes.length, ...filtered, ...novos);
        setFontes([...allFontes]);
        setLoadingFontes(false);
      });
      unsubs.push(u);
    };

    carrega('treinamentos',  'treinamento',   'descricao',  'titulo');
    carrega('knowledgeBase', 'knowledgeBase', 'rawText',    'title');

    return () => unsubs.forEach(u => u());
  }, []);

  /* ── carrega resultados do usuário ──────────────────────── */
  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, 'examesResultados'),
      where('userId', '==', user.id),
    );
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExameResultado));
      // ordena client-side para evitar índice composto no Firestore
      docs.sort((a, b) => {
        const tA = a.createdAt?.toMillis?.() ?? 0;
        const tB = b.createdAt?.toMillis?.() ?? 0;
        return tB - tA;
      });
      setResultados(docs);
    });
  }, [user?.id]);

  /* ── verifica bloqueio para uma fonte ───────────────────── */
  const verificaBloqueio = useCallback((fonteId: string) => {
    const ultimo = resultados.find(r => r.fonteId === fonteId && !r.aprovado);
    if (!ultimo?.proximaTentativa) return null;
    const dias = diasRestantes(ultimo.proximaTentativa);
    return dias > 0 ? dias : null;
  }, [resultados]);

  /* ── verifica aprovação anterior ────────────────────────── */
  const jaAprovado = useCallback((fonteId: string) =>
    resultados.some(r => r.fonteId === fonteId && r.aprovado),
  [resultados]);

  /* ── gera exame ─────────────────────────────────────────── */
  const handleGerarExame = async () => {
    if (!fonteEscolhida) return;

    const bloqueio = verificaBloqueio(fonteEscolhida.id);
    if (bloqueio) {
      showToast(`Você está bloqueado por mais ${bloqueio} dia(s). Aguarde antes de tentar novamente.`, 'error');
      return;
    }

    if (!fonteEscolhida.conteudo || fonteEscolhida.conteudo.length < 50) {
      showToast('Este conteúdo não possui texto suficiente para gerar um exame.', 'error');
      return;
    }

    setFase('gerando');
    try {
      const qs = await GeminiService.generateExam(fonteEscolhida.titulo, fonteEscolhida.conteudo, 10);
      setQuestoes(qs);
      setRespostas({});
      setFase('fazendo');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao gerar exame com IA. Tente novamente.', 'error');
      setFase('escolher');
    }
  };

  /* ── submete respostas ──────────────────────────────────── */
  const handleSubmeter = async () => {
    if (Object.keys(respostas).length < questoes.length) {
      showToast('Responda todas as questões antes de enviar.', 'error');
      return;
    }

    let acertos = 0;
    const detalhes = questoes.map(q => {
      const escolhida = respostas[q.id] || '';
      const correta = q.correta;
      if (escolhida === correta) acertos++;
      return { questaoId: q.id, escolhida, correta };
    });

    const score = Math.round((acertos / questoes.length) * 100);
    const aprovado = score >= NOTA_APROVACAO;

    setResultado({ score, aprovado });
    setFase('resultado');

    /* salva no Firestore */
    setSalvando(true);
    try {
      const proximaTentativa = aprovado
        ? null
        : Timestamp.fromDate(new Date(Date.now() + DIAS_BLOQUEIO * 86_400_000));

      await addDoc(collection(db, 'examesResultados'), {
        userId: user.id,
        userName: user.name,
        tenantId: user.tenantId,
        fonteId: fonteEscolhida!.id,
        fonteTitulo: fonteEscolhida!.titulo,
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

  /* ── certificado ────────────────────────────────────────── */
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
      .cert h1 { font-family: 'Playfair Display', serif; font-size: 42px; color: #1e3a5f; margin: 0 0 10px; }
      .tipo { font-size: 11px; letter-spacing: 5px; text-transform: uppercase; color: #c9a84c; margin-bottom: 30px; font-weight: 600; }
      .texto { font-size: 15px; color: #555; line-height: 1.8; margin-bottom: 10px; }
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
      <p class="curso">${fonteEscolhida?.titulo || 'Treinamento'}</p>
      <p class="texto" style="font-size:13px;color:#888">Nota obtida: <strong>${resultado?.score}%</strong></p>
      <p class="data">Emitido em ${data}</p>
      <div style="display:flex;justify-content:center;gap:80px;margin-top:50px">
        <div class="assinatura">MJ Consultoria<br>Coordenação de Treinamento</div>
      </div>
    </div></body></html>`);
    win.document.close();
    win.print();
  };

  /* ── progresso do exame em curso ────────────────────────── */
  const totalRespondidas = Object.keys(respostas).length;
  const percentualFeito = questoes.length > 0
    ? Math.round((totalRespondidas / questoes.length) * 100)
    : 0;

  /* ═══════════════ RENDER ══════════════════════════════════ */

  /* FASE: gerando */
  if (fase === 'gerando') {
    return (
      <div className="p-8 min-h-screen bg-[#0D1B3E] flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 rounded-full bg-blue-600/20 flex items-center justify-center animate-pulse">
          <i className="fa-solid fa-brain text-blue-400 text-3xl"></i>
        </div>
        <div className="text-center">
          <p className="text-white font-black text-xl uppercase tracking-widest">Gerando Exame com IA</p>
          <p className="text-slate-400 text-sm mt-2">Elaborando questões com Taxonomia de Bloom...</p>
        </div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${i*0.15}s` }}></span>
          ))}
        </div>
      </div>
    );
  }

  /* FASE: fazendo o exame */
  if (fase === 'fazendo') {
    return (
      <div className="p-6 md:p-8 min-h-screen bg-[#0D1B3E] space-y-6 animate-in fade-in">
        {/* cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
              Exame: <span className="text-blue-400">{fonteEscolhida?.titulo}</span>
            </h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
              {questoes.length} questões · Nota mínima {NOTA_APROVACAO}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-white">{totalRespondidas}<span className="text-slate-300">/{questoes.length}</span></p>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Respondidas</p>
          </div>
        </div>

        {/* barra de progresso */}
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${percentualFeito}%` }}></div>
        </div>

        {/* questões */}
        <div className="space-y-5">
          {questoes.map((q, idx) => {
            const { label: bloomLbl, color: bloomColor } = bloomLabel(q.bloom);
            const respondida = respostas[q.id];
            return (
              <div key={q.id}
                className={`bg-white border rounded-[20px] p-5 space-y-4 transition-all ${
                  respondida ? 'border-blue-500/40' : 'border-[#C9A84C]/30'
                }`}>
                <div className="flex items-start gap-3">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-${bloomColor}-500/20 text-${bloomColor}-400 flex-shrink-0 mt-0.5`}>
                    {bloomLbl}
                  </span>
                  <p className="text-sm font-bold text-white leading-relaxed">
                    <span className="text-slate-400 mr-2">{idx + 1}.</span>{q.enunciado}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                  {q.alternativas.map(alt => (
                    <button key={alt.letra} type="button"
                      onClick={() => setRespostas(prev => ({ ...prev, [q.id]: alt.letra }))}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        respondida === alt.letra
                          ? 'border-blue-500 bg-blue-500/20 text-white'
                          : 'border-[#C9A84C]/30 hover:border-slate-600 text-slate-200 hover:bg-slate-900'
                      }`}>
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        respondida === alt.letra ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'
                      }`}>{alt.letra}</span>
                      <span className="text-xs leading-snug">{alt.texto}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* botão enviar */}
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={handleSubmeter}
            disabled={totalRespondidas < questoes.length}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-black uppercase tracking-widest rounded-2xl transition-all text-sm shadow-lg shadow-blue-900/30">
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

  /* FASE: resultado */
  if (fase === 'resultado' && resultado) {
    const { score, aprovado } = resultado;
    return (
      <div className="p-8 min-h-screen bg-[#0D1B3E] flex flex-col items-center justify-center gap-6 animate-in fade-in">
        {/* badge principal */}
        <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-lg ${
          aprovado ? 'bg-emerald-500/20 shadow-emerald-900/30' : 'bg-red-500/20 shadow-red-900/30'
        }`}>
          <i className={`fa-solid ${aprovado ? 'fa-trophy' : 'fa-xmark'} text-4xl ${aprovado ? 'text-emerald-400' : 'text-red-400'}`}></i>
        </div>

        <div className="text-center space-y-2">
          <p className={`text-5xl font-black ${aprovado ? 'text-emerald-400' : 'text-red-400'}`}>{score}%</p>
          <p className="text-xl font-black text-white uppercase tracking-widest">
            {aprovado ? 'Aprovado!' : 'Reprovado'}
          </p>
          <p className="text-slate-500 text-sm max-w-sm">
            {aprovado
              ? `Parabéns! Você atingiu a nota mínima de ${NOTA_APROVACAO}% neste exame.`
              : `Você precisava de ${NOTA_APROVACAO}% para aprovação. Você poderá tentar novamente em ${DIAS_BLOQUEIO} dias.`
            }
          </p>
        </div>

        {/* gabarito */}
        <div className="w-full max-w-2xl bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[24px] p-6 space-y-3">
          <h3 className="text-white font-black uppercase text-sm">Gabarito</h3>
          <div className="space-y-2">
            {questoes.map((q, idx) => {
              const escolhida = respostas[q.id] || '';
              const acertou = escolhida === q.correta;
              return (
                <div key={q.id} className={`p-3 rounded-xl border ${acertou ? 'border-emerald-800/50 bg-emerald-900/10' : 'border-red-800/50 bg-red-900/10'}`}>
                  <div className="flex items-start gap-2">
                    <i className={`fa-solid ${acertou ? 'fa-check' : 'fa-xmark'} text-${acertou ? 'emerald' : 'red'}-400 text-xs mt-1 flex-shrink-0`}></i>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white leading-snug">{idx + 1}. {q.enunciado.substring(0, 80)}{q.enunciado.length > 80 ? '...' : ''}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Sua resposta: <span className={acertou ? 'text-emerald-400' : 'text-red-400'}>{escolhida}</span>
                        {!acertou && <span className="text-emerald-400 ml-2">· Correta: {q.correta}</span>}
                      </p>
                      {!acertou && q.justificativa && (
                        <p className="text-[10px] text-slate-400 mt-1 italic">{q.justificativa}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ações */}
        <div className="flex flex-wrap gap-3 justify-center">
          {aprovado && (
            <button onClick={imprimirCertificado}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest rounded-xl transition-all text-sm">
              <i className="fa-solid fa-certificate mr-2"></i>Emitir Certificado
            </button>
          )}
          <button onClick={() => { setFase('escolher'); setFonteEscolhida(null); setResultado(null); }}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-widest rounded-xl transition-all text-sm">
            <i className="fa-solid fa-arrow-left mr-2"></i>Voltar
          </button>
        </div>

        {salvando && <p className="text-slate-400 text-xs">Salvando resultado...</p>}
      </div>
    );
  }

  /* FASE: escolher conteúdo */
  return (
    <div className="p-6 md:p-8 min-h-screen bg-[#0D1B3E] space-y-6 animate-in fade-in">
      {/* cabeçalho */}
      <header>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Exames <span className="text-blue-400">IA</span>
        </h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
          Avaliações geradas automaticamente com Taxonomia de Bloom
        </p>
      </header>

      {/* info bloom */}
      <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[20px] p-5 grid grid-cols-3 gap-4">
        {[
          { bloom: 'compreensao', label: 'Compreensão', pct: '30%', color: 'blue',    desc: 'Identificar e descrever conceitos' },
          { bloom: 'aplicacao',   label: 'Aplicação',   pct: '40%', color: 'emerald', desc: 'Utilizar e demonstrar na prática'  },
          { bloom: 'analise',     label: 'Análise',     pct: '30%', color: 'purple',  desc: 'Comparar, examinar e avaliar'      },
        ].map(b => (
          <div key={b.bloom} className="text-center space-y-1">
            <span className={`text-xs font-black uppercase text-${b.color}-400`}>{b.label}</span>
            <p className={`text-2xl font-black text-${b.color}-400`}>{b.pct}</p>
            <p className="text-[9px] text-slate-300">{b.desc}</p>
          </div>
        ))}
      </div>

      {/* lista de conteúdos */}
      <div>
        <h3 className="text-white font-black uppercase text-sm mb-4">
          <i className="fa-solid fa-list-check text-blue-400 mr-2"></i>
          Escolha o conteúdo para o exame
        </h3>

        {loadingFontes ? (
          <div className="text-slate-400 text-sm italic">Carregando conteúdos...</div>
        ) : fontes.filter(f => f.conteudo && f.conteudo.length >= 50).length === 0 ? (
          <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[20px] p-8 text-center text-slate-400 text-sm italic">
            Nenhum conteúdo com texto suficiente encontrado.<br/>
            Adicione treinamentos ou documentos na Base de Conhecimento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fontes.filter(f => f.conteudo && f.conteudo.length >= 50).map(fonte => {
              const bloqueio = verificaBloqueio(fonte.id);
              const aprovado = jaAprovado(fonte.id);
              const ultimoResult = resultados.find(r => r.fonteId === fonte.id);
              const selecionada = fonteEscolhida?.id === fonte.id;

              return (
                <div key={fonte.id}
                  onClick={() => !bloqueio && setFonteEscolhida(selecionada ? null : fonte)}
                  className={`bg-white border rounded-[20px] p-5 cursor-pointer transition-all space-y-3 ${
                    bloqueio
                      ? 'border-[#C9A84C]/30 opacity-50 cursor-not-allowed'
                      : selecionada
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[#C9A84C]/30 hover:border-slate-600 hover:bg-slate-900/30'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      fonte.tipo === 'treinamento'  ? 'bg-emerald-500/20'  :
                      fonte.tipo === 'knowledgeBase'? 'bg-amber-500/20'   :
                      fonte.tipo === 'video'        ? 'bg-red-500/20'     : 'bg-blue-500/20'
                    }`}>
                      <i className={`fa-solid text-sm ${
                        fonte.tipo === 'treinamento'  ? 'fa-graduation-cap text-emerald-400' :
                        fonte.tipo === 'knowledgeBase'? 'fa-book-open text-amber-400'       :
                        fonte.tipo === 'video'        ? 'fa-play text-red-400'             : 'fa-list-check text-blue-400'
                      }`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate">{fonte.titulo}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">
                        {fonte.tipo === 'treinamento' ? 'Treinamento' :
                         fonte.tipo === 'knowledgeBase' ? 'Base de Conhecimento' :
                         fonte.tipo === 'video' ? 'Vídeo' : 'Checklist'}
                      </p>
                    </div>
                    {selecionada && !bloqueio && (
                      <i className="fa-solid fa-circle-check text-blue-400 text-lg flex-shrink-0"></i>
                    )}
                  </div>

                  {/* status */}
                  {bloqueio ? (
                    <div className="flex items-center gap-2 text-[10px] text-red-400 font-black">
                      <i className="fa-solid fa-lock"></i>
                      Disponível em {bloqueio} dia(s)
                    </div>
                  ) : aprovado ? (
                    <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-black">
                      <i className="fa-solid fa-trophy"></i>
                      Aprovado · {ultimoResult?.score}%
                    </div>
                  ) : ultimoResult && !ultimoResult.aprovado ? (
                    <div className="flex items-center gap-2 text-[10px] text-amber-400 font-black">
                      <i className="fa-solid fa-rotate-right"></i>
                      Última tentativa: {ultimoResult.score}% · Refazer disponível
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-300 font-black">
                      <i className="fa-solid fa-star mr-1"></i>Novo
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* botão gerar */}
      {fonteEscolhida && (
        <div className="flex justify-center pt-2 pb-8">
          <button onClick={handleGerarExame}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all text-sm shadow-lg shadow-blue-900/30 flex items-center gap-3">
            <i className="fa-solid fa-brain text-lg"></i>
            Gerar Exame com IA
            <span className="text-blue-200 text-xs font-normal">10 questões · Bloom médio</span>
          </button>
        </div>
      )}

      {/* histórico pessoal */}
      {resultados.length > 0 && (
        <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[24px] p-6 space-y-4">
          <h3 className="text-white font-black uppercase text-sm flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-slate-500"></i>
            Meu Histórico de Exames
          </h3>
          <div className="space-y-2">
            {resultados.slice(0, 10).map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${r.aprovado ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  <i className={`fa-solid ${r.aprovado ? 'fa-trophy' : 'fa-xmark'} ${r.aprovado ? 'text-emerald-400' : 'text-red-400'} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{r.fonteTitulo}</p>
                  <p className="text-[9px] text-slate-400">{r.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || ''}</p>
                </div>
                <p className={`text-sm font-black ${r.aprovado ? 'text-emerald-400' : 'text-red-400'}`}>{r.score}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamesView;
