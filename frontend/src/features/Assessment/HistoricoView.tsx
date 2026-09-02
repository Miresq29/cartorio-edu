import React from 'react';
import { Assessment } from './types';
import { labelNivel, situacaoScore } from './scoring';

interface Props {
  assessments: Assessment[];
  loading: boolean;
  onNovo: () => void;
  onSelecionar: (assessment: Assessment) => void;
}

function formatData(ts: any): string {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const CORES: Record<string, { text: string; bg: string }> = {
  critico: { text: 'text-red-500', bg: 'bg-red-500/10' },
  gap: { text: 'text-amber-600', bg: 'bg-amber-500/10' },
  adequado: { text: 'text-emerald-600', bg: 'bg-emerald-500/10' },
};

const HistoricoView: React.FC<Props> = ({ assessments, loading, onNovo, onSelecionar }) => {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">
            Diagnóstico de <span className="text-[#C9A84C]">Maturidade</span>
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
            Segurança da Informação · Provimentos CNJ 149/213 e LGPD
          </p>
        </div>
        <button onClick={onNovo}
          className="flex items-center gap-2 bg-[#C9A84C] hover:brightness-110 text-[#0A1628] px-5 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-sm">
          <i className="fa-solid fa-plus"></i>Iniciar novo diagnóstico
        </button>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800">
        <i className="fa-solid fa-circle-info mr-2"></i>
        O assessment cobre 10 dimensões e 40 indicadores, inspirado no Program Maturity Assessment,
        adaptado aos Provimentos CNJ e à LGPD. Ao final, a plataforma calcula o nível de maturidade,
        gera um plano de ação com trilhas recomendadas e permite exportar um PDF completo.
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Carregando histórico...</p>
      ) : assessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-40">
          <i className="fa-solid fa-clipboard-check text-5xl text-slate-500 mb-4"></i>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Nenhum diagnóstico realizado ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a, i) => {
            const anterior = assessments[i + 1];
            const delta = anterior ? a.scoreGlobal - anterior.scoreGlobal : null;
            const sit = situacaoScore(a.scoreGlobal);
            const cor = CORES[sit];
            return (
              <button key={a.id} onClick={() => onSelecionar(a)}
                className="w-full text-left bg-white border border-slate-200 hover:border-[#C9A84C] rounded-2xl p-5 flex items-center gap-5 transition-all">
                <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${cor.bg}`}>
                  <span className={`text-xl font-black ${cor.text}`}>{a.scoreGlobal}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[#0A1628]">{a.periodo}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {labelNivel(a.nivel)} · Respondido em {formatData(a.respondidoEm)} por {a.respondidoPorNome}
                  </p>
                  {a.bloqueado && (
                    <span className="inline-block mt-1 text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded">
                      Nível travado — dimensão crítica abaixo de 40%
                    </span>
                  )}
                </div>
                {delta !== null && (
                  <span className={`text-xs font-black flex-shrink-0 ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    <i className={`fa-solid ${delta >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'} mr-1`}></i>
                    {Math.abs(delta)}%
                  </span>
                )}
                <i className="fa-solid fa-chevron-right text-slate-300"></i>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoricoView;
