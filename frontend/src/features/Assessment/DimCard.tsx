import React from 'react';
import { Dimensao } from './types';
import IndicadorInput from './IndicadorInput';
import { calcularScoreDim } from './scoring';

interface Props {
  dimensao: Dimensao;
  respostas: Record<string, boolean | number | null>;
  onChange: (indId: string, value: boolean | number) => void;
}

const DimCard: React.FC<Props> = ({ dimensao, respostas, onChange }) => {
  const respondidos = dimensao.indicadores.filter(i => respostas[i.id] !== undefined && respostas[i.id] !== null).length;
  const previewScore = calcularScoreDim(
    dimensao.indicadores
      .filter(i => respostas[i.id] !== undefined && respostas[i.id] !== null)
      .map(i => ({ indId: i.id, tipo: i.tipo, peso: i.peso, resposta: respostas[i.id] ?? null }))
  );

  return (
    <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-black text-navy">{dimensao.nome}</h3>
          <p className="text-sm text-slate-500 mt-1">{dimensao.desc}</p>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">{dimensao.ref}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-black text-navy">{respondidos > 0 ? `${previewScore}%` : '–'}</p>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{respondidos}/{dimensao.indicadores.length} respondidos</p>
        </div>
      </div>

      <div className="space-y-4 divide-y divide-slate-100">
        {dimensao.indicadores.map(ind => (
          <div key={ind.id} className="pt-4 first:pt-0">
            <IndicadorInput
              indicador={ind}
              value={respostas[ind.id] ?? null}
              onChange={v => onChange(ind.id, v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DimCard;
