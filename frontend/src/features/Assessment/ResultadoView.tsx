import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Assessment, PrioridadeGap } from './types';
import { DIMENSOES } from './constants';
import { labelNivel, situacaoScore } from './scoring';
import { gerarResumoIA } from './ia';
import { gerarPDFAssessment } from './AssessmentPrintView';

interface Props {
  assessment: Assessment;
  onVoltar: () => void;
}

const CORES_SITUACAO: Record<string, string> = { critico: '#DC2626', gap: '#D97706', adequado: '#059669' };
const LABEL_SITUACAO: Record<string, string> = { critico: 'Crítico', gap: 'Gap', adequado: 'Adequado' };
const CORES_PRIORIDADE: Record<PrioridadeGap, { text: string; bg: string }> = {
  urgente: { text: 'text-red-600', bg: 'bg-red-500/10 border-red-200' },
  alta: { text: 'text-amber-700', bg: 'bg-amber-500/10 border-amber-200' },
  baixa: { text: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-200' },
};

const ResultadoView: React.FC<Props> = ({ assessment, onVoltar }) => {
  const { state, tenantId, setActiveTab } = useApp();
  const { showToast } = useToast();
  const [assessmentAtual, setAssessmentAtual] = useState<Assessment>(assessment);
  const [gerandoResumo, setGerandoResumo] = useState(false);

  // A geração automática do resumo executivo (disparada em AssessmentView logo após
  // salvar o diagnóstico) termina de forma assíncrona, depois desta tela já estar
  // montada — sem isto, o resumo gerado nunca apareceria sem um recarregamento manual.
  useEffect(() => {
    setAssessmentAtual(assessment);
  }, [assessment]);

  const gerarResumo = async () => {
    setGerandoResumo(true);
    try {
      const resultado = await gerarResumoIA(assessmentAtual);
      if (!resultado.resumoExecutivo?.analiseGeral) {
        showToast('Erro ao gerar o resumo executivo.', 'error');
        return;
      }
      await updateDoc(doc(db, 'assessments', assessmentAtual.id), {
        resumoExecutivo: resultado.resumoExecutivo,
        recomendacoesPorDim: resultado.recomendacoesPorDim,
        atualizadoEm: serverTimestamp(),
      });
      setAssessmentAtual(prev => ({ ...prev, resumoExecutivo: resultado.resumoExecutivo, recomendacoesPorDim: resultado.recomendacoesPorDim }));
      showToast('Resumo executivo gerado e salvo.', 'success');
    } catch {
      showToast('Erro ao gerar o resumo executivo. Tente novamente.', 'error');
    } finally {
      setGerandoResumo(false);
    }
  };

  const gerarPDF = () => {
    gerarPDFAssessment(assessmentAtual, {
      tenantName: state.activeTenantName || tenantId,
      userName: state.user?.name || '',
    });
  };

  const chartData = DIMENSOES.map(d => ({
    nome: d.nome.length > 16 ? d.nome.slice(0, 14) + '…' : d.nome,
    Score: assessmentAtual.scoresPorDim[d.id] ?? 0,
    situacao: situacaoScore(assessmentAtual.scoresPorDim[d.id] ?? 0),
  }));

  const sitGlobal = situacaoScore(assessmentAtual.scoreGlobal);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onVoltar} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-xs font-black uppercase tracking-widest">
          <i className="fa-solid fa-arrow-left"></i>Voltar ao histórico
        </button>
        <button onClick={gerarPDF}
          className="flex items-center gap-2 bg-gold hover:brightness-110 text-navy px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-sm">
          <i className="fa-solid fa-file-pdf"></i>Exportar PDF
        </button>
      </header>

      {/* Badge de nível/score */}
      <div className="bg-white border border-slate-200 rounded-[24px] p-6 flex items-center gap-6 flex-wrap">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${CORES_SITUACAO[sitGlobal]}15` }}>
          <span className="text-3xl font-black" style={{ color: CORES_SITUACAO[sitGlobal] }}>{assessmentAtual.scoreGlobal}%</span>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xl font-black text-navy">{labelNivel(assessmentAtual.nivel)}</p>
          <p className="text-sm text-slate-500 mt-0.5">{assessmentAtual.periodo} · Score ponderado global</p>
          {assessmentAtual.bloqueado && (
            <p className="text-xs font-black text-red-500 uppercase tracking-widest mt-2">
              <i className="fa-solid fa-triangle-exclamation mr-1"></i>
              Nível travado em no máximo 2 — uma dimensão crítica (Capacitação ou LGPD) está abaixo de 40%
            </p>
          )}
        </div>
      </div>

      {/* Resumo executivo com IA */}
      <div className="bg-white border border-gold/30 rounded-[24px] p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Resumo executivo com IA</p>
          <button onClick={gerarResumo} disabled={gerandoResumo}
            className="bg-gold hover:brightness-110 disabled:opacity-50 text-navy px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            {gerandoResumo ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Gerando...</> : <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>{assessmentAtual.resumoExecutivo ? 'Gerar novamente' : 'Gerar resumo executivo'}</>}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Estrutura um resumo com cabeçalho, introdução, objetivo e análise citando o artigo específico de cada dimensão com gap — incluído automaticamente no PDF exportado.
        </p>

        {assessmentAtual.resumoExecutivo && (
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <h4 className="text-base font-black text-navy">{assessmentAtual.resumoExecutivo.cabecalho}</h4>

              {assessmentAtual.resumoExecutivo.introducao && (
                <div>
                  <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-1">Introdução</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{assessmentAtual.resumoExecutivo.introducao}</p>
                </div>
              )}

              {assessmentAtual.resumoExecutivo.objetivo && (
                <div>
                  <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-1">Objetivo</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{assessmentAtual.resumoExecutivo.objetivo}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-1">Análise</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{assessmentAtual.resumoExecutivo.analiseGeral}</p>
              </div>
            </div>

            {/* Gráfico por dimensão — acompanha a análise, não isolado do texto */}
            <div>
              <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-2">Score por dimensão</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="nome" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-35} textAnchor="end" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Bar dataKey="Score" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={CORES_SITUACAO[d.situacao]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {!assessmentAtual.resumoExecutivo && (
        /* Gráfico por dimensão — exibido mesmo sem resumo gerado ainda */
        <div className="bg-white border border-slate-200 rounded-[24px] p-5 space-y-3">
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Score por dimensão</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="nome" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-35} textAnchor="end" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="Score" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={CORES_SITUACAO[d.situacao]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela por dimensão */}
      <div className="bg-white border border-slate-200 rounded-[24px] p-5 space-y-3">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Detalhamento por dimensão</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                {['Dimensão', 'Peso', 'Score', 'Situação'].map(h => (
                  <th key={h} className="text-left p-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIMENSOES.map(d => {
                const score = assessmentAtual.scoresPorDim[d.id] ?? 0;
                const sit = situacaoScore(score);
                return (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="p-2 font-bold text-navy">{d.nome}</td>
                    <td className="p-2 text-slate-500">{d.peso}%</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${score}%`, background: CORES_SITUACAO[sit] }}></div>
                        </div>
                        <span className="font-black" style={{ color: CORES_SITUACAO[sit] }}>{score}%</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ background: `${CORES_SITUACAO[sit]}15`, color: CORES_SITUACAO[sit] }}>
                        {LABEL_SITUACAO[sit]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plano de ação */}
      <div className="bg-white border border-slate-200 rounded-[24px] p-5 space-y-3">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Plano de ação prioritário</p>
        {assessmentAtual.gaps.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum gap identificado — parabéns!</p>
        ) : (
          <div className="space-y-2">
            {assessmentAtual.gaps.map((g, i) => (
              <div key={i} className={`border rounded-xl p-4 flex items-start gap-4 flex-wrap ${CORES_PRIORIDADE[g.prioridade].bg}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex-shrink-0 ${CORES_PRIORIDADE[g.prioridade].text}`}>
                  {g.prioridade}
                </span>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-bold text-navy">{g.textoIndicador}</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span><i className="fa-solid fa-road mr-1"></i>{g.trilhaRecomendada}</span>
                    {g.trilhaRecomendada.includes('(trilha oficial)') && (
                      <button onClick={() => setActiveTab('trails')}
                        className="text-[9px] font-black text-navy uppercase tracking-widest bg-gold/20 hover:bg-gold/40 px-2 py-0.5 rounded-lg transition-all">
                        Ir para Trilhas <i className="fa-solid fa-arrow-right ml-1"></i>
                      </button>
                    )}
                  </p>
                  {assessmentAtual.recomendacoesPorDim?.[g.dimId] && (
                    <p className="text-xs text-slate-600 mt-1 italic">
                      <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>{assessmentAtual.recomendacoesPorDim[g.dimId]}
                    </p>
                  )}
                </div>
                <span className="text-xs font-black text-slate-600 flex-shrink-0">Prazo: {g.prazoSugerido}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultadoView;
