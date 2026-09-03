import React, { useEffect } from 'react';
import { Indicador } from './types';

interface Props {
  indicador: Indicador;
  value: boolean | number | null;
  onChange: (value: boolean | number) => void;
}

const IndicadorInput: React.FC<Props> = ({ indicador, value, onChange }) => {
  // O slider sempre exibe 0% quando não respondido — sem isto, o valor mostrado
  // (0%) nunca é registrado como resposta, porque um <input type="range"> só
  // dispara onChange quando o valor muda, e arrastar de 0 para 0 não muda nada.
  useEffect(() => {
    if (indicador.tipo === 'metrica' && (value === null || value === undefined)) {
      onChange(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicador.id]);

  if (indicador.tipo === 'metrica') {
    const num = typeof value === 'number' ? value : 0;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-700">{indicador.texto}</p>
          <span className="text-sm font-black text-navy flex-shrink-0 ml-3">{num}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={5} value={num}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-[#C9A84C]"
        />
      </div>
    );
  }

  // sim_nao e documento usam o mesmo toggle — só muda a semântica da pergunta.
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-slate-700 flex-1">
        {indicador.texto}
        {indicador.tipo === 'documento' && (
          <span className="ml-2 text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-1.5 py-0.5 rounded">
            Documento
          </span>
        )}
      </p>
      <div className="flex gap-2 flex-shrink-0">
        <button type="button" onClick={() => onChange(true)}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
            value === true ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}>
          Sim
        </button>
        <button type="button" onClick={() => onChange(false)}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
            value === false ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}>
          Não
        </button>
      </div>
    </div>
  );
};

export default IndicadorInput;
