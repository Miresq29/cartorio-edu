// "Onde a equipe mais erra" — taxa de erro por assunto, setor e assunto × setor, perguntas mais
// erradas e reforço recomendado. Os dados vêm da function relatorioErros (enunciados e gabaritos
// ficam em coleções sem acesso pelo cliente).
import React, { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';

interface Agregado { questoes: number; erros: number; pessoas: number; taxaErro: number }
interface PerguntaDetalhada {
  enunciado: string; assunto: string; fonte: string; bloom: string; correta: string; justificativa: string;
  vezes: number; erros: number; taxaErro: number; pessoas: number; setores: string[];
  alternativas: { texto: string; vezes: number; correta: boolean }[]; respostaErradaMaisEscolhida: string;
}
interface FonteResumo extends Agregado { fonteChave: string; fonte: string; assunto: string; comEnunciado: number }
interface Resultado {
  fontes?: FonteResumo[];
  fonteChave?: string;
  perguntasDaFonte?: PerguntaDetalhada[];
  dias: number;
  totais: { questoes: number; erros: number; avaliacoes: number; pessoas: number; comEnunciado?: number };
  porAssunto: (Agregado & { assunto: string })[];
  porSetor: (Agregado & { setor: string })[];
  porFonte: (Agregado & { assunto: string; fonte: string })[];
  porBloom: (Agregado & { bloom: string })[];
  matriz: (Agregado & { assunto: string; setor: string })[];
  perguntasMaisErradas: { enunciado: string; assunto: string; fonte: string; bloom: string; correta: string; justificativa: string; vezes: number; erros: number; taxaErro: number; setores: string[] }[];
  recomendacoes: (Agregado & { assunto: string; setor: string })[];
}

const relatorioErrosFn = httpsCallable<{ tenantId?: string; dias?: number; fonteChave?: string }, Resultado>(functions, 'relatorioErros');

// Todas as perguntas de uma prova, da mais errada para a menos errada, com quantas vezes cada
// alternativa foi escolhida (a errada mais escolhida mostra o equívoco mais comum da equipe).
const PerguntasDaProva: React.FC<{ tenantId: string; dias: number; fontes: FonteResumo[] }> = ({ tenantId, dias, fontes }) => {
  const [fonteChave, setFonteChave] = useState('');
  const [perguntas, setPerguntas] = useState<PerguntaDetalhada[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setPerguntas(null); setErro('');
    if (!fonteChave) return;
    let ativo = true;
    setCarregando(true);
    relatorioErrosFn({ tenantId, dias: Math.min(730, dias), fonteChave })
      .then(r => { if (ativo) setPerguntas(r.data.perguntasDaFonte || []); })
      .catch(e => { if (ativo) setErro(e?.message || 'Não foi possível carregar as perguntas.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [tenantId, dias, fonteChave]);

  const fonte = fontes.find(f => f.fonteChave === fonteChave);

  const exportar = () => {
    if (!perguntas || !fonte) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [
      [esc('Prova'), esc(fonte.fonte)].join(';'),
      '',
      ['Pergunta', 'Vezes respondida', 'Erros', 'Taxa de erro (%)', 'Pessoas', 'Resposta correta', 'Resposta errada mais escolhida', 'Distribuição das respostas', 'Por quê'].map(esc).join(';'),
      ...perguntas.map(p => [p.enunciado, p.vezes, p.erros, p.taxaErro, p.pessoas, p.correta, p.respostaErradaMaisEscolhida,
        p.alternativas.map(a => `${a.correta ? '✔ ' : ''}${a.texto}: ${a.vezes}`).join(' | '), p.justificativa].map(esc).join(';')),
    ];
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `perguntas_${fonte.fonte.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
        <p className="text-xs font-black text-navy uppercase tracking-widest">Perguntas de uma prova</p>
        <select value={fonteChave} onChange={e => setFonteChave(e.target.value)} title="Escolha a prova"
          className="flex-1 min-w-[240px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-gold">
          <option value="">Escolha a prova ou quiz…</option>
          {fontes.map(f => (
            <option key={f.fonteChave} value={f.fonteChave}>
              {f.fonte} — {f.taxaErro}% de erro, {f.pessoas} pessoa{f.pessoas !== 1 ? 's' : ''}{f.comEnunciado === 0 ? ' (só histórico, sem texto das perguntas)' : ''}
            </option>
          ))}
        </select>
        {perguntas && perguntas.length > 0 && (
          <button onClick={exportar} className="flex items-center gap-2 bg-white border border-slate-200 hover:border-gold text-slate-600 px-3 py-2 rounded-xl text-xs font-bold">
            <i className="fa-solid fa-file-excel text-gold"></i>Exportar
          </button>
        )}
      </div>
      {!fonteChave ? (
        <p className="p-6 text-center text-sm text-slate-400">Escolha uma prova para ver todas as perguntas, da mais errada para a menos errada, e qual resposta errada a equipe mais escolheu.</p>
      ) : carregando ? (
        <p className="p-6 text-center text-sm text-slate-500">Carregando perguntas…</p>
      ) : erro ? (
        <p className="p-6 text-center text-sm text-red-600">{erro}</p>
      ) : !perguntas || perguntas.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-400">
          Nenhuma pergunta com texto registrado para esta prova no período. Provas feitas antes da correção pelo servidor guardaram só acerto/erro.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {perguntas.map((p, i) => (
            <li key={i} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-navy font-bold"><span className="text-slate-400 mr-1">{i + 1}.</span>{p.enunciado}</p>
                <span className="text-xs font-black whitespace-nowrap" style={{ color: corTaxa(p.taxaErro) }}>
                  {p.taxaErro}% de erro · {p.erros}/{p.vezes}
                </span>
              </div>
              <div className="space-y-1">
                {p.alternativas.map((a, j) => {
                  const pct = p.vezes ? Math.round((a.vezes / p.vezes) * 100) : 0;
                  const engana = !a.correta && a.texto === p.respostaErradaMaisEscolhida;
                  return (
                    <div key={j} className="flex items-center gap-3 text-xs">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: a.correta ? '#059669' : engana ? '#DC2626' : '#94A3B8' }} />
                      </div>
                      <span className="w-16 shrink-0 text-slate-500">{a.vezes} ({pct}%)</span>
                      <span className={a.correta ? 'text-emerald-700 font-bold' : engana ? 'text-red-700 font-bold' : 'text-slate-600'}>
                        {a.correta && <i className="fa-solid fa-check mr-1"></i>}{engana && <i className="fa-solid fa-triangle-exclamation mr-1"></i>}{a.texto}
                      </span>
                    </div>
                  );
                })}
              </div>
              {p.justificativa && <p className="text-[11px] text-slate-500"><strong>Por quê:</strong> {p.justificativa}</p>}
              {p.setores.length > 0 && <p className="text-[11px] text-slate-400">Setores com erro: {p.setores.join(', ')}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const BLOOM_LABEL: Record<string, string> = { compreensao: 'Compreensão', aplicacao: 'Aplicação', analise: 'Análise' };

const corTaxa = (t: number) => (t >= 40 ? '#DC2626' : t >= 25 ? '#D97706' : '#059669');

const Barra: React.FC<{ taxa: number }> = ({ taxa }) => (
  <div className="flex items-center gap-2 min-w-[140px]">
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, taxa)}%`, background: corTaxa(taxa) }} />
    </div>
    <span className="text-xs font-black w-10 text-right" style={{ color: corTaxa(taxa) }}>{taxa}%</span>
  </div>
);

const Tabela: React.FC<{ titulo: string; colunas: string[]; linhas: React.ReactNode[][]; vazio?: string }> = ({ titulo, colunas, linhas, vazio }) => (
  <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden">
    <p className="px-4 py-3 text-xs font-black text-navy uppercase tracking-widest border-b border-slate-100">{titulo}</p>
    {linhas.length === 0 ? (
      <p className="p-6 text-center text-sm text-slate-400">{vazio || 'Sem dados no período.'}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              {colunas.map(c => <th key={c} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-b border-slate-50 align-top">
                {l.map((c, j) => <td key={j} className="p-3 text-slate-700">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const RelatorioErrosPanel: React.FC<{ tenantId: string; dias: number }> = ({ tenantId, dias }) => {
  const [dados, setDados] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtroAssunto, setFiltroAssunto] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let ativo = true;
    setCarregando(true); setErro('');
    relatorioErrosFn({ tenantId, dias: Math.min(730, dias) })
      .then(r => { if (ativo) setDados(r.data); })
      .catch(e => { if (ativo) setErro(e?.message || 'Não foi possível gerar o relatório.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [tenantId, dias]);

  const matrizFiltrada = useMemo(() => (dados?.matriz || [])
    .filter(m => (!filtroAssunto || m.assunto === filtroAssunto) && (!filtroSetor || m.setor === filtroSetor)), [dados, filtroAssunto, filtroSetor]);
  const perguntasFiltradas = useMemo(() => (dados?.perguntasMaisErradas || [])
    .filter(p => (!filtroAssunto || p.assunto === filtroAssunto) && (!filtroSetor || p.setores.includes(filtroSetor))), [dados, filtroAssunto, filtroSetor]);

  const exportarCSV = () => {
    if (!dados) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [
      ['Assunto', 'Setor', 'Questões respondidas', 'Erros', 'Taxa de erro (%)', 'Pessoas'].map(esc).join(';'),
      ...dados.matriz.map(m => [m.assunto, m.setor, m.questoes, m.erros, m.taxaErro, m.pessoas].map(esc).join(';')),
      '',
      ['Pergunta', 'Assunto', 'Conteúdo', 'Vezes respondida', 'Erros', 'Taxa de erro (%)', 'Setores com erro', 'Resposta correta'].map(esc).join(';'),
      ...dados.perguntasMaisErradas.map(p => [p.enunciado, p.assunto, p.fonte, p.vezes, p.erros, p.taxaErro, p.setores.join(', '), p.correta].map(esc).join(';')),
    ];
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `erros_por_assunto_setor_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!tenantId) return <p className="text-sm text-slate-500 p-6 text-center">Entre em um cliente para ver este relatório.</p>;
  if (carregando) return (
    <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
      <div className="w-5 h-5 border-2 border-gold/50 border-t-indigo-600 rounded-full animate-spin"></div>
      <span className="text-sm">Analisando as respostas...</span>
    </div>
  );
  if (erro) return <p className="text-sm text-red-600 p-6 text-center">{erro}</p>;
  if (!dados) return null;

  const taxaGeral = dados.totais.questoes ? Math.round((dados.totais.erros / dados.totais.questoes) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-navy">Onde a equipe mais erra</p>
          <p className="text-xs text-slate-500">
            {dados.totais.questoes} questões respondidas em {dados.totais.avaliacoes} avaliações por {dados.totais.pessoas} pessoa(s), últimos {dados.dias} dias ·
            erro geral <strong style={{ color: corTaxa(taxaGeral) }}>{taxaGeral}%</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filtroAssunto} onChange={e => setFiltroAssunto(e.target.value)} title="Filtrar por assunto"
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-gold">
            <option value="">Todos os assuntos</option>
            {dados.porAssunto.map(a => <option key={a.assunto} value={a.assunto}>{a.assunto}</option>)}
          </select>
          <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)} title="Filtrar por setor"
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-gold">
            <option value="">Todos os setores</option>
            {dados.porSetor.map(s => <option key={s.setor} value={s.setor}>{s.setor}</option>)}
          </select>
          <button onClick={exportarCSV}
            className="flex items-center gap-2 bg-gold hover:bg-[#A8863C] text-navy px-4 py-2 rounded-xl text-xs font-bold transition-all">
            <i className="fa-solid fa-file-excel"></i>Exportar
          </button>
        </div>
      </div>

      {dados.totais.questoes === 0 ? (
        <div className="bg-white border border-slate-200 rounded-[14px] p-10 text-center text-sm text-slate-500">
          Nenhuma resposta registrada no período. As respostas dos quizzes de módulo passaram a ser guardadas em 13/10/2026;
          os exames já entram desde a correção pelo servidor.
        </div>
      ) : (
        <>
          {(dados.porAssunto.some(a => a.assunto === 'Sem assunto definido') || dados.porSetor.some(s => s.setor === 'Sem setor')) && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <i className="fa-solid fa-circle-info mt-0.5"></i>
              <p>
                Para separar por assunto e por setor: defina o <strong>assunto</strong> de cada trilha (Trilhas → editar) e o
                <strong> setor</strong> de cada colaborador (Colaboradores → Setores, depois edição em lote). O relatório se atualiza sozinho.
                {(dados.totais.comEnunciado ?? 0) < dados.totais.questoes && <> Exames feitos antes da correção pelo servidor entram nas taxas, mas não na lista de perguntas (o texto delas não foi guardado).</>}
              </p>
            </div>
          )}

          {/* Reforço recomendado */}
          <div className="bg-red-50 border border-red-200 rounded-[14px] p-4">
            <p className="text-xs font-black text-red-700 uppercase tracking-widest mb-2">
              <i className="fa-solid fa-bullseye mr-2"></i>Precisam de mais treinamento
            </p>
            {dados.recomendacoes.length === 0 ? (
              <p className="text-sm text-red-700/80">Nenhuma combinação de assunto e setor com erro acima de 30% (mínimo de 7 questões respondidas).</p>
            ) : (
              <ul className="space-y-1.5">
                {dados.recomendacoes.map((r, i) => (
                  <li key={i} className="text-sm text-red-800">
                    <strong>{r.assunto}</strong> no setor <strong>{r.setor}</strong> — {r.taxaErro}% de erro
                    <span className="text-red-700/70"> ({r.erros} de {r.questoes} questões, {r.pessoas} pessoa{r.pessoas !== 1 ? 's' : ''})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Tabela titulo="Por assunto" colunas={['Assunto', 'Erro', 'Questões', 'Pessoas']}
              linhas={dados.porAssunto.map(a => [<strong>{a.assunto}</strong>, <Barra taxa={a.taxaErro} />, `${a.erros}/${a.questoes}`, a.pessoas])} />
            <Tabela titulo="Por setor" colunas={['Setor', 'Erro', 'Questões', 'Pessoas']}
              linhas={dados.porSetor.map(s => [<strong>{s.setor}</strong>, <Barra taxa={s.taxaErro} />, `${s.erros}/${s.questoes}`, s.pessoas])} />
          </div>

          <Tabela titulo="Assunto × setor" colunas={['Assunto', 'Setor', 'Erro', 'Questões', 'Pessoas']}
            linhas={matrizFiltrada.map(m => [m.assunto, m.setor, <Barra taxa={m.taxaErro} />, `${m.erros}/${m.questoes}`, m.pessoas])} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Tabela titulo="Conteúdos com mais erro (trilha › módulo ou exame)" colunas={['Conteúdo', 'Assunto', 'Erro', 'Questões']}
                linhas={(dados.porFonte || []).filter(f => !filtroAssunto || f.assunto === filtroAssunto)
                  .map(f => [f.fonte, f.assunto, <Barra taxa={f.taxaErro} />, `${f.erros}/${f.questoes}`])} />
            </div>
            <Tabela titulo="Por nível da questão" colunas={['Nível', 'Erro', 'Questões']}
              linhas={dados.porBloom.map(b => [BLOOM_LABEL[b.bloom] || b.bloom, <Barra taxa={b.taxaErro} />, `${b.erros}/${b.questoes}`])} />
          </div>

          <PerguntasDaProva tenantId={tenantId} dias={dias} fontes={dados.fontes || []} />

          <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden">
            <p className="px-4 py-3 text-xs font-black text-navy uppercase tracking-widest border-b border-slate-100">
              Perguntas mais erradas <span className="text-slate-400 font-bold normal-case tracking-normal">— clique para ver a resposta correta</span>
            </p>
            {perguntasFiltradas.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">Nenhuma pergunta errada com esses filtros.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {perguntasFiltradas.map((p, i) => (
                  <li key={i} className="p-4 cursor-pointer hover:bg-slate-50" onClick={() => setAberta(aberta === i ? null : i)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-navy font-bold">{p.enunciado}</p>
                        <p className="text-[11px] text-slate-500">
                          {p.assunto} · {p.fonte}{p.bloom ? ` · ${BLOOM_LABEL[p.bloom] || p.bloom}` : ''}
                          {p.setores.length > 0 && <> · setores com erro: {p.setores.join(', ')}</>}
                        </p>
                      </div>
                      <span className="text-xs font-black whitespace-nowrap" style={{ color: corTaxa(p.taxaErro) }}>
                        {p.erros} erro{p.erros !== 1 ? 's' : ''} / {p.vezes}
                      </span>
                    </div>
                    {aberta === i && (
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
                        <p><strong>Resposta correta:</strong> {p.correta || '—'}</p>
                        {p.justificativa && <p><strong>Por quê:</strong> {p.justificativa}</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RelatorioErrosPanel;
