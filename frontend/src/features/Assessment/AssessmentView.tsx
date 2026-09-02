import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { DIMENSOES } from './constants';
import { montarAssessment, calcularScoreDim } from './scoring';
import { gerarResumoIA } from './ia';
import { Assessment, RespostaDim } from './types';
import DimCard from './DimCard';
import ResultadoView from './ResultadoView';
import HistoricoView from './HistoricoView';

type Modo = 'historico' | 'wizard' | 'resultado';
type RespostasWizard = Record<string, Record<string, boolean | number | null>>;

function tsToMillis(ts: any): number {
  if (!ts) return 0;
  return ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
}

const AssessmentView: React.FC = () => {
  const { state, tenantId } = useApp();
  const { showToast } = useToast();
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(state.user?.role || '');

  const [modo, setModo] = useState<Modo>('historico');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [assessmentAtual, setAssessmentAtual] = useState<Assessment | null>(null);

  const [periodo, setPeriodo] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [respostas, setRespostas] = useState<RespostasWizard>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'assessments'), where('tenantId', '==', tenantId));
    return onSnapshot(q, s => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() } as Assessment));
      docs.sort((a, b) => tsToMillis(b.respondidoEm) - tsToMillis(a.respondidoEm));
      setAssessments(docs);
      setLoadingHistorico(false);
    });
  }, [tenantId]);

  const iniciarNovo = () => {
    const p = window.prompt('Período de referência deste diagnóstico (ex: Janeiro–Junho 2026):');
    if (!p || !p.trim()) return;
    setPeriodo(p.trim());
    setRespostas({});
    setStepIndex(0);
    setModo('wizard');
  };

  const dimensaoAtual = DIMENSOES[stepIndex];
  const respostasDim = respostas[dimensaoAtual.id] || {};
  const dimensaoCompleta = dimensaoAtual.indicadores.every(i => respostasDim[i.id] !== undefined && respostasDim[i.id] !== null);

  const onChangeResposta = (indId: string, value: boolean | number) => {
    setRespostas(prev => ({
      ...prev,
      [dimensaoAtual.id]: { ...(prev[dimensaoAtual.id] || {}), [indId]: value },
    }));
  };

  const finalizarAssessment = async () => {
    setSalvando(true);
    try {
      const respostasPorDim: RespostaDim[] = DIMENSOES.map(dim => {
        const respDim = respostas[dim.id] || {};
        const indicadores = dim.indicadores.map(ind => ({
          indId: ind.id, tipo: ind.tipo, peso: ind.peso, resposta: respDim[ind.id] ?? null,
        }));
        return { dimId: dim.id, indicadores, scoreDim: calcularScoreDim(indicadores) };
      });

      const montado = montarAssessment(respostasPorDim, {
        tenantId, respondidoPor: state.user?.id || '', respondidoPorNome: state.user?.name || '', periodo,
      });

      const docRef = await addDoc(collection(db, 'assessments'), {
        ...montado, respondidoEm: serverTimestamp(), criadoEm: serverTimestamp(),
      });

      let assessmentSalvo: Assessment = { ...montado, id: docRef.id, respondidoEm: new Date(), criadoEm: new Date() };

      // Gera o resumo executivo automaticamente — o diagnóstico não deve ficar
      // sem análise da IA à espera de alguém lembrar de clicar em "Gerar". Faz parte
      // do mesmo "Calculando..." para não expor um resultado sem resumo por alguns
      // segundos nem arriscar concorrência com uma geração manual na tela seguinte.
      try {
        const resultado = await gerarResumoIA(assessmentSalvo);
        if (resultado.resumoExecutivo?.analiseGeral) {
          await updateDoc(doc(db, 'assessments', docRef.id), {
            resumoExecutivo: resultado.resumoExecutivo,
            recomendacoesPorDim: resultado.recomendacoesPorDim,
            atualizadoEm: serverTimestamp(),
          });
          assessmentSalvo = { ...assessmentSalvo, resumoExecutivo: resultado.resumoExecutivo, recomendacoesPorDim: resultado.recomendacoesPorDim };
        }
      } catch {
        // Falha na geração automática não deve bloquear o diagnóstico já salvo —
        // o gestor pode gerar manualmente depois na tela de resultado.
      }

      setAssessmentAtual(assessmentSalvo);
      setModo('resultado');
      showToast('Diagnóstico concluído!', 'success');
    } catch {
      showToast('Erro ao salvar o diagnóstico. Tente novamente.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  if (!isGestor) {
    return (
      <div className="p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm">Você não tem permissão para acessar esta tela.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">
      {modo === 'historico' && (
        <HistoricoView
          assessments={assessments}
          loading={loadingHistorico}
          onNovo={iniciarNovo}
          onSelecionar={a => { setAssessmentAtual(a); setModo('resultado'); }}
        />
      )}

      {modo === 'wizard' && (
        <div className="space-y-5">
          <header>
            <p className="text-[10px] font-black text-[#C9A84C] uppercase tracking-widest">
              Etapa {stepIndex + 1} de {DIMENSOES.length} · {periodo}
            </p>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
              <div className="h-1.5 rounded-full bg-[#C9A84C] transition-all" style={{ width: `${((stepIndex + 1) / DIMENSOES.length) * 100}%` }}></div>
            </div>
          </header>

          <DimCard dimensao={dimensaoAtual} respostas={respostasDim} onChange={onChangeResposta} />

          <div className="flex items-center justify-between">
            {stepIndex > 0 ? (
              <button onClick={() => setStepIndex(i => i - 1)}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:border-slate-400 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                <i className="fa-solid fa-arrow-left"></i>Anterior
              </button>
            ) : (
              <button onClick={() => setModo('historico')}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:border-slate-400 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                Cancelar
              </button>
            )}

            {stepIndex < DIMENSOES.length - 1 ? (
              <button onClick={() => setStepIndex(i => i + 1)} disabled={!dimensaoCompleta}
                className="flex items-center gap-2 px-6 py-3 bg-[#C9A84C] hover:brightness-110 disabled:opacity-40 text-[#0A1628] rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                Próxima<i className="fa-solid fa-arrow-right"></i>
              </button>
            ) : (
              <button onClick={finalizarAssessment} disabled={!dimensaoCompleta || salvando}
                className="flex items-center gap-2 px-6 py-3 bg-[#C9A84C] hover:brightness-110 disabled:opacity-40 text-[#0A1628] rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                {salvando ? <><i className="fa-solid fa-circle-notch animate-spin"></i>Calculando e gerando resumo com IA...</> : <><i className="fa-solid fa-flag-checkered"></i>Concluir e calcular</>}
              </button>
            )}
          </div>
        </div>
      )}

      {modo === 'resultado' && assessmentAtual && (
        <ResultadoView assessment={assessmentAtual} onVoltar={() => setModo('historico')} />
      )}
    </div>
  );
};

export default AssessmentView;
