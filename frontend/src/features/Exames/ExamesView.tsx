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
  tipo: 'treinamento' | 'knowledgeBase' | 'video' | 'trilha';
  cargaHoraria?: number;
  instrutor?: string;
  oficial?: boolean;
}

function gerarCodigoVerificacao(): string {
  return `MJ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
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
  const { state, tenantId } = useApp();
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
  const [numQuestoes, setNumQuestoes] = useState<5 | 7 | 10>(5);

  /* ── carrega fontes de conteúdo ─────────────────────────── */
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    const allFontes: FonteConteudo[] = [];

    const tenantFilter = [tenantId, 'GLOBAL'];
    const carrega = (colecao: string, tipo: FonteConteudo['tipo'], campoConteudo: string, campoTitulo: string) => {
      const u = onSnapshot(query(collection(db, colecao), where('tenantIds', 'array-contains-any', tenantFilter)), snap => {
        const novos = snap.docs.map(d => ({
          id: d.id,
          titulo: d.data()[campoTitulo] || d.data()['title'] || d.data()['nome'] || 'Sem título',
          conteudo: d.data()[campoConteudo] || d.data()['content'] || d.data()['rawText'] || d.data()['descricao'] || '',
          tipo,
          cargaHoraria: d.data()['cargaHoraria'],
          instrutor: d.data()['instrutor'],
          oficial: d.data()['oficial'],
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

    // Trilhas de capacitação também servem de fonte de conteúdo — concatena o
    // texto de todos os módulos, que é onde o conteúdo real das trilhas mora.
    const uTrilhas = onSnapshot(query(collection(db, 'trilhas'), where('tenantIds', 'array-contains-any', tenantFilter)), snap => {
      const novos = snap.docs.map(d => {
        const data = d.data();
        const conteudo = (data.modulos || [])
          .map((m: any) => `${m.titulo ? m.titulo + ':\n' : ''}${m.conteudo || ''}`)
          .join('\n\n');
        return {
          id: d.id, titulo: data.titulo || 'Sem título', conteudo, tipo: 'trilha' as const,
          cargaHoraria: data.cargaHoraria, instrutor: data.instrutor, oficial: data.oficial,
        };
      });
      const filtered = allFontes.filter(f => f.tipo !== 'trilha');
      allFontes.splice(0, allFontes.length, ...filtered, ...novos);
      setFontes([...allFontes]);
      setLoadingFontes(false);
    });
    unsubs.push(uTrilhas);

    return () => unsubs.forEach(u => u());
  }, [tenantId]);

  /* ── carrega resultados do usuário ──────────────────────── */
  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, 'examesResultados'),
      where('userId', '==', user.id),
      where('tenantId', '==', tenantId),
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
  }, [user?.id, tenantId]);

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
      const qs = await GeminiService.generateExam(fonteEscolhida.titulo, fonteEscolhida.conteudo, numQuestoes);
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
        tenantId,
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
    const codigo = gerarCodigoVerificacao();
    // Trilhas/treinamentos oficiais (distribuídos pela MJ Consultoria) sempre saem
    // com "Mirian Jabur" como instrutora; carga horária nunca sai zerada — mínimo
    // de 1h quando a fonte não informou.
    const instrutor = fonteEscolhida?.oficial ? 'Mirian Jabur' : (fonteEscolhida?.instrutor || 'Mirian Jabur');
    const cargaHoraria = Math.max(1, fonteEscolhida?.cargaHoraria || 1);
    win.document.write(`<!DOCTYPE html><html><head><title>Certificado</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Dancing+Script:wght@700&family=Inter:wght@400;600;800&display=swap');
      body { margin: 0; font-family: 'Inter', sans-serif; background: #eee9dd; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .cert { width: 980px; background: #fffdf7; border: 14px double #1e3a5f; padding: 64px 90px; text-align: center; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
      .cert::before { content: ''; position: absolute; inset: 10px; border: 1.5px solid #c9a84c; pointer-events: none; }
      .corner { position: absolute; width: 34px; height: 34px; border: 3px solid #c9a84c; }
      .corner.tl { top: 22px; left: 22px; border-right: none; border-bottom: none; }
      .corner.tr { top: 22px; right: 22px; border-left: none; border-bottom: none; }
      .corner.bl { bottom: 22px; left: 22px; border-right: none; border-top: none; }
      .corner.br { bottom: 22px; right: 22px; border-left: none; border-top: none; }
      .logo { font-size: 12px; font-weight: 800; letter-spacing: 4px; color: #1e3a5f; text-transform: uppercase; margin-bottom: 6px; }
      .subrazao { font-size: 9px; letter-spacing: 2px; color: #999; text-transform: uppercase; margin-bottom: 28px; }
      .cert h1 { font-family: 'Playfair Display', serif; font-weight: 900; font-size: 46px; color: #1e3a5f; margin: 0 0 8px; }
      .tipo { font-size: 11px; letter-spacing: 5px; text-transform: uppercase; color: #c9a84c; margin-bottom: 34px; font-weight: 700; }
      .texto { font-size: 15px; color: #555; line-height: 1.8; margin-bottom: 10px; }
      .nome { font-family: 'Playfair Display', serif; font-size: 34px; font-weight: 900; color: #1e3a5f; margin: 6px 0; border-bottom: 1.5px solid #c9a84c; display: inline-block; padding-bottom: 8px; }
      .curso { font-size: 21px; font-weight: 700; color: #1e3a5f; margin: 20px 0 6px; }
      .detalhes { font-size: 13px; color: #666; margin: 14px 0 0; }
      .detalhes strong { color: #1e3a5f; }
      .rodape { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 56px; gap: 24px; }
      .rodape-bloco { text-align: center; flex: 1; }
      .data-emissao { font-size: 12px; color: #888; }
      .assinatura-nome { font-family: 'Dancing Script', cursive; font-size: 34px; color: #1e3a5f; line-height: 1; margin-bottom: -4px; }
      .assinatura-linha { border-top: 1px solid #bbb; padding-top: 8px; font-size: 11px; color: #888; }
      .selo { width: 90px; height: 90px; border-radius: 50%; border: 2.5px solid #c9a84c; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle, #fffaf0, #fff); flex-shrink: 0; }
      .selo-txt { font-family: 'Playfair Display', serif; font-weight: 900; font-size: 9px; color: #1e3a5f; line-height: 1.3; text-align: center; }
      .verificacao { margin-top: 22px; font-size: 9px; color: #aaa; letter-spacing: 1px; text-transform: uppercase; }
      .conformidade { margin-top: 6px; font-size: 10px; color: #999; max-width: 640px; margin-left: auto; margin-right: auto; line-height: 1.5; }
      @media print { body { background: white; } .cert { box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>
    <div class="cert">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div class="logo">MJ Consultoria</div>
      <div class="subrazao">Plataforma de Treinamento e Conformidade Notarial</div>
      <h1>Certificado de Conclusão</h1>
      <div class="tipo">✦ Exame de Avaliação ✦</div>
      <p class="texto">Certificamos, para os devidos fins, que</p>
      <p class="nome">${user.name}</p>
      <p class="texto" style="margin-top:16px">foi aprovado(a) no exame de avaliação de conhecimentos referente a</p>
      <p class="curso">"${fonteEscolhida?.titulo || 'Treinamento'}"</p>
      <p class="detalhes">
        com aproveitamento de <strong>${resultado?.score}%</strong> e carga horária de <strong>${cargaHoraria} hora${cargaHoraria !== 1 ? 's' : ''}</strong>,
        sob instrução de <strong>${instrutor}</strong>.
      </p>
      <div class="rodape">
        <div class="rodape-bloco">
          <p class="data-emissao">Belo Horizonte, ${data}</p>
          <div class="assinatura-linha">Data de Emissão</div>
        </div>
        <div class="selo">
          <div class="selo-txt">CERTIFICADO<br>VÁLIDO</div>
        </div>
        <div class="rodape-bloco">
          <div class="assinatura-nome">Mirian Jabur</div>
          <div class="assinatura-linha">MJ Consultoria — Coordenação de Treinamento</div>
        </div>
      </div>
      <p class="conformidade">Documento emitido eletronicamente e válido como evidência de capacitação profissional, em conformidade com os Provimentos CNJ nº 161/2023, 213/2026 e 149/2023.</p>
      <p class="verificacao">Código de verificação: ${codigo}</p>
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
      <div className="p-8 min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 rounded-full bg-blue-600/20 flex items-center justify-center animate-pulse">
          <i className="fa-solid fa-brain text-blue-400 text-3xl"></i>
        </div>
        <div className="text-center">
          <p className="text-navy font-black text-xl uppercase tracking-widest">Gerando Exame com IA</p>
          <p className="text-slate-500 text-sm mt-2">Elaborando questões com Taxonomia de Bloom...</p>
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
      <div className="p-6 md:p-8 min-h-screen bg-slate-50 space-y-6 animate-in fade-in">
        {/* cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-navy uppercase tracking-tighter">
              Exame: <span className="text-blue-400">{fonteEscolhida?.titulo}</span>
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
              {questoes.length} questões · Nota mínima {NOTA_APROVACAO}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-navy">{totalRespondidas}<span className="text-slate-600">/{questoes.length}</span></p>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">Respondidas</p>
          </div>
        </div>

        {/* barra de progresso */}
        <div className="w-full bg-slate-200 rounded-full h-2">
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
                  respondida ? 'border-blue-500/40' : 'border-slate-200'
                }`}>
                <div className="flex items-start gap-3">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-${bloomColor}-500/20 text-${bloomColor}-400 flex-shrink-0 mt-0.5`}>
                    {bloomLbl}
                  </span>
                  <p className="text-sm font-bold text-navy leading-relaxed">
                    <span className="text-slate-500 mr-2">{idx + 1}.</span>{q.enunciado}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                  {q.alternativas.map(alt => (
                    <button key={alt.letra} type="button"
                      onClick={() => setRespostas(prev => ({ ...prev, [q.id]: alt.letra }))}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        respondida === alt.letra
                          ? 'border-blue-500 bg-blue-500/20 text-navy'
                          : 'border-slate-200 hover:border-slate-600 text-slate-700 hover:bg-slate-50'
                      }`}>
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        respondida === alt.letra ? 'bg-blue-500 text-navy' : 'bg-slate-200 text-slate-500'
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
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-navy font-black uppercase tracking-widest rounded-2xl transition-all text-sm shadow-lg shadow-blue-900/30">
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
      <div className="p-8 min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 animate-in fade-in">
        {/* badge principal */}
        <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-lg ${
          aprovado ? 'bg-emerald-500/20 shadow-emerald-900/30' : 'bg-red-500/20 shadow-red-900/30'
        }`}>
          <i className={`fa-solid ${aprovado ? 'fa-trophy' : 'fa-xmark'} text-4xl ${aprovado ? 'text-emerald-400' : 'text-red-400'}`}></i>
        </div>

        <div className="text-center space-y-2">
          <p className={`text-5xl font-black ${aprovado ? 'text-emerald-400' : 'text-red-400'}`}>{score}%</p>
          <p className="text-xl font-black text-navy uppercase tracking-widest">
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
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[24px] p-6 space-y-3">
          <h3 className="text-navy font-black uppercase text-sm">Gabarito</h3>
          <div className="space-y-2">
            {questoes.map((q, idx) => {
              const escolhida = respostas[q.id] || '';
              const acertou = escolhida === q.correta;
              return (
                <div key={q.id} className={`p-3 rounded-xl border ${acertou ? 'border-emerald-800/50 bg-emerald-900/10' : 'border-red-800/50 bg-red-900/10'}`}>
                  <div className="flex items-start gap-2">
                    <i className={`fa-solid ${acertou ? 'fa-check' : 'fa-xmark'} text-${acertou ? 'emerald' : 'red'}-400 text-xs mt-1 flex-shrink-0`}></i>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-navy leading-snug">{idx + 1}. {q.enunciado.substring(0, 80)}{q.enunciado.length > 80 ? '...' : ''}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Sua resposta: <span className={acertou ? 'text-emerald-400' : 'text-red-400'}>{escolhida}</span>
                        {!acertou && <span className="text-emerald-400 ml-2">· Correta: {q.correta}</span>}
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

        {/* ações */}
        <div className="flex flex-wrap gap-3 justify-center">
          {aprovado && (
            <button onClick={imprimirCertificado}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-navy font-black uppercase tracking-widest rounded-xl transition-all text-sm">
              <i className="fa-solid fa-certificate mr-2"></i>Emitir Certificado
            </button>
          )}
          <button onClick={() => { setFase('escolher'); setFonteEscolhida(null); setResultado(null); }}
            className="px-6 py-3 bg-slate-200 hover:bg-slate-700 text-navy font-black uppercase tracking-widest rounded-xl transition-all text-sm">
            <i className="fa-solid fa-arrow-left mr-2"></i>Voltar
          </button>
        </div>

        {salvando && <p className="text-slate-500 text-xs">Salvando resultado...</p>}
      </div>
    );
  }

  /* FASE: escolher conteúdo */
  return (
    <div className="p-6 md:p-8 min-h-screen bg-slate-50 space-y-6 animate-in fade-in">
      {/* cabeçalho */}
      <header>
        <h2 className="text-3xl font-black text-navy italic uppercase tracking-tighter">
          Exames <span className="text-blue-400">IA</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
          Avaliações geradas automaticamente com Taxonomia de Bloom
        </p>
      </header>

      {/* info bloom */}
      <div className="bg-white border border-slate-200 rounded-[20px] p-5 grid grid-cols-3 gap-4">
        {[
          { bloom: 'compreensao', label: 'Compreensão', pct: '30%', color: 'blue',    desc: 'Identificar e descrever conceitos' },
          { bloom: 'aplicacao',   label: 'Aplicação',   pct: '40%', color: 'emerald', desc: 'Utilizar e demonstrar na prática'  },
          { bloom: 'analise',     label: 'Análise',     pct: '30%', color: 'purple',  desc: 'Comparar, examinar e avaliar'      },
        ].map(b => (
          <div key={b.bloom} className="text-center space-y-1">
            <span className={`text-xs font-black uppercase text-${b.color}-400`}>{b.label}</span>
            <p className={`text-2xl font-black text-${b.color}-400`}>{b.pct}</p>
            <p className="text-[9px] text-slate-600">{b.desc}</p>
          </div>
        ))}
      </div>

      {/* lista de conteúdos */}
      <div>
        <h3 className="text-navy font-black uppercase text-sm mb-4">
          <i className="fa-solid fa-list-check text-blue-400 mr-2"></i>
          Escolha o conteúdo para o exame
        </h3>

        {loadingFontes ? (
          <div className="text-slate-500 text-sm italic">Carregando conteúdos...</div>
        ) : fontes.filter(f => f.conteudo && f.conteudo.length >= 50).length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[20px] p-8 text-center text-slate-500 text-sm italic">
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
                      ? 'border-slate-200 opacity-50 cursor-not-allowed'
                      : selecionada
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-200 hover:border-slate-600 hover:bg-slate-50/30'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      fonte.tipo === 'treinamento'  ? 'bg-emerald-500/20'  :
                      fonte.tipo === 'knowledgeBase'? 'bg-amber-500/20'   :
                      fonte.tipo === 'trilha'       ? 'bg-purple-500/20'  :
                      fonte.tipo === 'video'        ? 'bg-red-500/20'     : 'bg-blue-500/20'
                    }`}>
                      <i className={`fa-solid text-sm ${
                        fonte.tipo === 'treinamento'  ? 'fa-graduation-cap text-emerald-400' :
                        fonte.tipo === 'knowledgeBase'? 'fa-book-open text-amber-400'       :
                        fonte.tipo === 'trilha'       ? 'fa-road text-purple-400'           :
                        fonte.tipo === 'video'        ? 'fa-play text-red-400'             : 'fa-list-check text-blue-400'
                      }`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-navy truncate">{fonte.titulo}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">
                        {fonte.tipo === 'treinamento' ? 'Treinamento' :
                         fonte.tipo === 'knowledgeBase' ? 'Base de Conhecimento' :
                         fonte.tipo === 'trilha' ? 'Trilha de Capacitação' : 'Vídeo'}
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
                    <div className="text-[10px] text-slate-600 font-black">
                      <i className="fa-solid fa-star mr-1"></i>Novo
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* seletor de questões + botão gerar */}
      {fonteEscolhida && (
        <div className="flex flex-col items-center gap-4 pt-2 pb-8">
          {/* seletor de quantidade */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#7a5c1e] uppercase tracking-widest">Questões:</span>
            {([5, 7, 10] as const).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setNumQuestoes(n)}
                className={`w-10 h-10 rounded-xl text-sm font-black transition-all border ${
                  numQuestoes === n
                    ? 'bg-gold text-navy border-gold shadow-sm'
                    : 'bg-white text-[#8a6e2f] border-gold/30 hover:border-gold/60'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button onClick={handleGerarExame}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all text-sm shadow-lg shadow-blue-900/30 flex items-center gap-3">
            <i className="fa-solid fa-brain text-lg"></i>
            Gerar Exame com IA
            <span className="text-blue-200 text-xs font-normal">{numQuestoes} questões · Bloom médio</span>
          </button>
        </div>
      )}

      {/* histórico pessoal */}
      {resultados.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4">
          <h3 className="text-navy font-black uppercase text-sm flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-slate-500"></i>
            Meu Histórico de Exames
          </h3>
          <div className="space-y-2">
            {resultados.slice(0, 10).map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${r.aprovado ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  <i className={`fa-solid ${r.aprovado ? 'fa-trophy' : 'fa-xmark'} ${r.aprovado ? 'text-emerald-400' : 'text-red-400'} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-navy truncate">{r.fonteTitulo}</p>
                  <p className="text-[9px] text-slate-500">{r.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || ''}</p>
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
