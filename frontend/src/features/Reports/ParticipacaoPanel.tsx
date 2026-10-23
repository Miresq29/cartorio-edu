// "Quem fez e quem não fez" — escolhe uma trilha ou uma prova e lista TODOS os colaboradores do
// cliente com a situação de cada um (não iniciou / em andamento / concluiu; não fez / reprovado /
// aprovado), melhor nota, tentativas, datas e certificado. Os dados vêm da function
// relatorioParticipacao, que cruza tudo por ID no servidor (nunca por nome).
import React, { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';

interface Colaborador { id: string; nome: string; email: string; setor: string; cargo: string; perfil: string; ativo: boolean }
interface Trilha { id: string; titulo: string; assunto: string; ativa: boolean; setores: string[]; perfis: string[]; obrigatorios: number }
interface Prova { chave: string; tipo: string; titulo: string; removida?: boolean }
interface ProgressoTrilha { percentual: number; concluida: boolean; concluidaEm: number | null; iniciadaEm: number | null; quizzesAprovados: number }
interface SituacaoProva { tentativas: number; melhorNota: number; ultimaNota: number; aprovado: boolean; aprovadoEm: number | null; ultimaEm: number | null; historico: boolean; bloqueadoAte: number | null }
interface Certificado { curso: string; cursoChave: string; codigo: string; tipo: string; emitidoEm: number | null; versao: number; quantidade: number }
interface Dados {
  geradoEm: number;
  colaboradores: Colaborador[]; trilhas: Trilha[]; provas: Prova[];
  progresso: Record<string, Record<string, ProgressoTrilha>>;
  exames: Record<string, Record<string, SituacaoProva>>;
  certificados: Record<string, Certificado[]>;
}

const relatorioParticipacaoFn = httpsCallable<{ tenantId?: string }, Dados>(functions, 'relatorioParticipacao');

type Situacao = 'concluiu' | 'andamento' | 'nao_iniciou' | 'aprovado' | 'reprovado' | 'nao_fez' | 'nao_se_aplica';
const SITUACAO: Record<Situacao, { label: string; cor: string; fundo: string }> = {
  concluiu:      { label: 'Concluiu',        cor: '#047857', fundo: '#ECFDF5' },
  aprovado:      { label: 'Aprovado',        cor: '#047857', fundo: '#ECFDF5' },
  andamento:     { label: 'Em andamento',    cor: '#B45309', fundo: '#FFFBEB' },
  reprovado:     { label: 'Reprovado',       cor: '#B91C1C', fundo: '#FEF2F2' },
  nao_iniciou:   { label: 'Não iniciou',     cor: '#475569', fundo: '#F1F5F9' },
  nao_fez:       { label: 'Não fez',         cor: '#475569', fundo: '#F1F5F9' },
  nao_se_aplica: { label: 'Não se aplica',   cor: '#94A3B8', fundo: '#F8FAFC' },
};
const TIPO_PROVA: Record<string, string> = { trilha: 'Prova da trilha', video: 'Prova do vídeo/áudio', treinamento: 'Treinamento', knowledgeBase: 'Base de conhecimento', questionario: 'Questionário da gestão', removida: 'Conteúdo removido' };

const normalizar = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
const data = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '—');

interface Linha { c: Colaborador; situacao: Situacao; detalhe: string; quando: string; certificado: string; obs: string }

const ParticipacaoPanel: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState<'trilha' | 'prova'>('trilha');
  const [itemId, setItemId] = useState('');
  const [filtro, setFiltro] = useState<Situacao | ''>('');
  const [busca, setBusca] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);

  const carregar = () => {
    if (!tenantId) return;
    setCarregando(true); setErro('');
    relatorioParticipacaoFn({ tenantId })
      .then(r => setDados(r.data))
      .catch(e => setErro(e?.message || 'Não foi possível gerar o relatório.'))
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, [tenantId]);
  useEffect(() => { setItemId(''); setFiltro(''); }, [modo]);

  const pessoas = useMemo(() => (dados?.colaboradores || []).filter(c => incluirInativos || c.ativo), [dados, incluirInativos]);

  const certificadoDe = (uid: string, titulo: string) => {
    const lista = dados?.certificados[uid] || [];
    const alvo = normalizar(titulo);
    return lista.find(c => c.cursoChave === alvo || c.cursoChave.startsWith(alvo + ' › '));
  };

  const situacaoTrilha = (c: Colaborador, t: Trilha): Linha => {
    const cert = certificadoDe(c.id, t.titulo);
    const certificado = cert ? cert.codigo + (cert.quantidade > 1 ? ` (+${cert.quantidade - 1})` : '') : '—';
    const fora = (t.setores.length > 0 && !t.setores.includes(c.setor)) || (t.perfis.length > 0 && !t.perfis.includes(c.perfil));
    const p = dados?.progresso[c.id]?.[t.id];
    if (p?.concluida) return { c, situacao: 'concluiu', detalhe: '100%', quando: data(p.concluidaEm), certificado, obs: p.concluidaEm ? '' : 'concluída antes do registro da data' };
    if (p) return { c, situacao: 'andamento', detalhe: `${p.percentual}%`, quando: data(p.iniciadaEm), certificado, obs: '' };
    if (fora) return { c, situacao: 'nao_se_aplica', detalhe: '—', quando: '—', certificado, obs: t.setores.length ? `trilha só para: ${t.setores.join(', ')}` : 'perfil fora do público da trilha' };
    return { c, situacao: 'nao_iniciou', detalhe: '0%', quando: '—', certificado, obs: '' };
  };

  const situacaoProva = (c: Colaborador, p: Prova): Linha => {
    const cert = certificadoDe(c.id, p.titulo);
    const certificado = cert ? cert.codigo + (cert.quantidade > 1 ? ` (+${cert.quantidade - 1})` : '') : '—';
    const s = dados?.exames[c.id]?.[p.chave];
    if (!s) return { c, situacao: 'nao_fez', detalhe: '—', quando: '—', certificado, obs: '' };
    const detalhe = `${s.melhorNota}%${s.tentativas > 1 ? ` · ${s.tentativas} tentativas` : ''}`;
    const obs = [s.historico ? 'inclui registro histórico' : '', s.bloqueadoAte ? `pode refazer em ${data(s.bloqueadoAte)}` : ''].filter(Boolean).join(' · ');
    return s.aprovado
      ? { c, situacao: 'aprovado', detalhe, quando: data(s.aprovadoEm), certificado, obs }
      : { c, situacao: 'reprovado', detalhe, quando: data(s.ultimaEm), certificado, obs };
  };

  const trilhaSel = dados?.trilhas.find(t => t.id === itemId);
  const provaSel = dados?.provas.find(p => p.chave === itemId);
  const linhas: Linha[] = useMemo(() => {
    if (!dados) return [];
    if (modo === 'trilha' && trilhaSel) return pessoas.map(c => situacaoTrilha(c, trilhaSel));
    if (modo === 'prova' && provaSel) return pessoas.map(c => situacaoProva(c, provaSel));
    return [];
  }, [dados, modo, trilhaSel, provaSel, pessoas]);

  const contagem = useMemo(() => {
    const m: Partial<Record<Situacao, number>> = {};
    linhas.forEach(l => { m[l.situacao] = (m[l.situacao] || 0) + 1; });
    return m;
  }, [linhas]);
  const visiveis = linhas.filter(l => (!filtro || l.situacao === filtro)
    && (!busca || normalizar(`${l.c.nome} ${l.c.email} ${l.c.setor} ${l.c.cargo}`).includes(normalizar(busca))));

  // Resumo para o seletor: "concluíram/aplicável".
  const resumoTrilha = (t: Trilha) => {
    const ls = pessoas.map(c => situacaoTrilha(c, t)).filter(l => l.situacao !== 'nao_se_aplica');
    return `${ls.filter(l => l.situacao === 'concluiu').length}/${ls.length}`;
  };
  const resumoProva = (p: Prova) => `${pessoas.filter(c => dados?.exames[c.id]?.[p.chave]?.aprovado).length}/${pessoas.length}`;

  const baixarCSV = (nome: string, linhasCsv: (string | number)[][]) => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const blob = new Blob(['﻿' + linhasCsv.map(l => l.map(esc).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${nome}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportarLista = () => {
    const titulo = trilhaSel?.titulo || provaSel?.titulo || '';
    baixarCSV(`quem_fez_${normalizar(titulo).replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`, [
      [modo === 'trilha' ? 'Trilha' : 'Prova', titulo],
      [],
      ['Colaborador', 'E-mail', 'Setor', 'Cargo', 'Situação', modo === 'trilha' ? 'Progresso' : 'Melhor nota / tentativas', 'Data', 'Certificado', 'Observação'],
      ...visiveis.map(l => [l.c.nome, l.c.email, l.c.setor, l.c.cargo, SITUACAO[l.situacao].label, l.detalhe, l.quando, l.certificado, l.obs]),
    ]);
  };

  // Matriz completa: uma linha por colaborador, uma coluna por trilha e por prova.
  const exportarMatriz = () => {
    if (!dados) return;
    const provasAtivas = dados.provas.filter(p => !p.removida || pessoas.some(c => dados.exames[c.id]?.[p.chave]));
    baixarCSV('matriz_quem_fez', [
      ['Colaborador', 'E-mail', 'Setor', 'Cargo', 'Ativo',
        ...dados.trilhas.map(t => `Trilha: ${t.titulo}`),
        ...provasAtivas.map(p => `Prova: ${p.titulo}`)],
      ...pessoas.map(c => [c.nome, c.email, c.setor, c.cargo, c.ativo ? 'sim' : 'não',
        ...dados.trilhas.map(t => { const l = situacaoTrilha(c, t); return l.situacao === 'andamento' ? `${SITUACAO.andamento.label} (${l.detalhe})` : SITUACAO[l.situacao].label; }),
        ...provasAtivas.map(p => { const l = situacaoProva(c, p); return l.situacao === 'nao_fez' ? SITUACAO.nao_fez.label : `${SITUACAO[l.situacao].label} (${l.detalhe})`; })]),
    ]);
  };

  if (!tenantId) return <p className="text-sm text-slate-500 p-6 text-center">Entre em um cliente para ver este relatório.</p>;
  if (carregando && !dados) return (
    <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
      <div className="w-5 h-5 border-2 border-gold/50 border-t-indigo-600 rounded-full animate-spin"></div>
      <span className="text-sm">Cruzando colaboradores, trilhas e provas...</span>
    </div>
  );
  if (erro) return <p className="text-sm text-red-600 p-6 text-center">{erro}</p>;
  if (!dados) return null;

  const ordemChips: Situacao[] = modo === 'trilha' ? ['concluiu', 'andamento', 'nao_iniciou', 'nao_se_aplica'] : ['aprovado', 'reprovado', 'nao_fez'];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-navy">Quem fez e quem não fez</p>
          <p className="text-xs text-slate-500">
            {pessoas.length} colaborador{pessoas.length !== 1 ? 'es' : ''} · {dados.trilhas.length} trilhas · {dados.provas.filter(p => !p.removida).length} provas ·
            dados de todo o período, atualizados em {new Date(dados.geradoEm).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={carregar} disabled={carregando}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-400 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
            <i className={`fa-solid fa-rotate ${carregando ? 'animate-spin' : ''}`}></i>Atualizar
          </button>
          <button onClick={exportarMatriz}
            className="flex items-center gap-2 bg-gold hover:bg-[#A8863C] text-navy px-4 py-2 rounded-xl text-xs font-bold transition-all">
            <i className="fa-solid fa-table"></i>Exportar matriz completa
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-slate-100 rounded-xl p-1">
          {(['trilha', 'prova'] as const).map(m => (
            <button key={m} onClick={() => setModo(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${modo === m ? 'bg-white text-navy shadow-sm' : 'text-slate-500'}`}>
              {m === 'trilha' ? 'Trilhas (cursos)' : 'Provas'}
            </button>
          ))}
        </div>
        <select value={itemId} onChange={e => { setItemId(e.target.value); setFiltro(''); }} title={modo === 'trilha' ? 'Escolha a trilha' : 'Escolha a prova'}
          className="flex-1 min-w-[260px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-gold">
          <option value="">{modo === 'trilha' ? 'Escolha uma trilha…' : 'Escolha uma prova…'}</option>
          {modo === 'trilha'
            ? dados.trilhas.map(t => <option key={t.id} value={t.id}>{t.titulo}{t.ativa ? '' : ' (inativa)'} — {resumoTrilha(t)} concluíram</option>)
            : dados.provas.map(p => <option key={p.chave} value={p.chave}>{p.titulo} · {TIPO_PROVA[p.tipo] || p.tipo} — {resumoProva(p)} aprovados</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={incluirInativos} onChange={e => setIncluirInativos(e.target.checked)} />
          Incluir inativos
        </label>
      </div>

      {!itemId ? (
        <div className="bg-white border border-slate-200 rounded-[14px] p-10 text-center text-sm text-slate-500">
          Escolha {modo === 'trilha' ? 'uma trilha' : 'uma prova'} para ver a situação de cada colaborador.
          Para tudo de uma vez, use <strong>Exportar matriz completa</strong>.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFiltro('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black border ${!filtro ? 'border-navy text-navy' : 'border-slate-200 text-slate-500'}`}>
              Todos · {linhas.length}
            </button>
            {ordemChips.map(s => (
              <button key={s} onClick={() => setFiltro(filtro === s ? '' : s)}
                className="px-3 py-1.5 rounded-lg text-xs font-black border"
                style={{ color: SITUACAO[s].cor, background: SITUACAO[s].fundo, borderColor: filtro === s ? SITUACAO[s].cor : 'transparent' }}>
                {SITUACAO[s].label} · {contagem[s] || 0}
              </button>
            ))}
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, e-mail, setor…"
              className="ml-auto bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-gold w-56" />
            <button onClick={exportarLista}
              className="flex items-center gap-2 bg-white border border-slate-200 hover:border-gold text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold">
              <i className="fa-solid fa-file-excel text-gold"></i>Exportar esta lista
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-[14px] overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Colaborador', 'Setor', 'Situação', modo === 'trilha' ? 'Progresso' : 'Melhor nota', modo === 'trilha' ? 'Concluída / iniciada em' : 'Aprovado / última em', 'Certificado', 'Observação'].map(c => (
                    <th key={c} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map(l => (
                  <tr key={l.c.id} className="border-b border-slate-50">
                    <td className="p-3">
                      <p className="font-bold text-navy">{l.c.nome}{!l.c.ativo && <span className="ml-1 text-[10px] text-slate-400 font-normal">(inativo)</span>}</p>
                      <p className="text-[10px] text-slate-400">{l.c.email}</p>
                    </td>
                    <td className="p-3 text-slate-600">{l.c.setor || '—'}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-md text-[10px] font-black whitespace-nowrap" style={{ color: SITUACAO[l.situacao].cor, background: SITUACAO[l.situacao].fundo }}>
                        {SITUACAO[l.situacao].label}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 whitespace-nowrap">{l.detalhe}</td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">{l.quando}</td>
                    <td className="p-3 text-slate-600 whitespace-nowrap font-mono text-[10px]">{l.certificado}</td>
                    <td className="p-3 text-[11px] text-slate-500">{l.obs}</td>
                  </tr>
                ))}
                {visiveis.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-400">Ninguém nessa situação.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">
            Nota = melhor nota entre as tentativas. "Inclui registro histórico" = prova corrigida no navegador, antes de 11/10/2026.
            Certificado: um por pessoa e curso; "(+1)" indica que o mesmo curso tem outro certificado emitido (outro formato ou tipo).
          </p>
        </>
      )}
    </div>
  );
};

export default ParticipacaoPanel;
