// frontend/src/features/Metas/MetasView.tsx
// Módulo de Metas e Premiação com desempate via Quiz Bloom Alto (Nível 5-6)

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, query, orderBy, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Metrica = 'media_quizzes' | 'trilhas_concluidas' | 'exames_aprovados' | 'total_pontos';
type StatusMeta = 'rascunho' | 'ativa' | 'encerrada';
type FaseDesempate = 'aguardando' | 'gerando' | 'respondendo' | 'resultado';

interface Meta {
  id: string;
  titulo: string;
  descricao: string;
  metrica: Metrica;
  topN: number;
  premio: string;
  dataInicio: string;
  dataFim: string;
  status: StatusMeta;
  tenantId: string;
  createdBy: string;
  createdAt: any;
}

interface QuizResult {
  id: string;
  colaborador: string;
  nota: number;
  aprovado: boolean;
  createdAt: any;
}

interface TrilhaProgresso {
  id: string;
  userId: string;
  userName: string;
  concluida: boolean;
  tenantId: string;
}

interface ExameResultado {
  id: string;
  userId: string;
  userName: string;
  aprovado: boolean;
  score: number;
  tenantId: string;
}

interface RankingItem {
  nome: string;
  valor: number;
  isPremiated: boolean;
  empatado?: boolean;
}

interface DesempateQuestao {
  id: number;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
  correta: string;
  bloom: 'avaliacao' | 'criacao';
  justificativa: string;
}

interface DesempateSession {
  id: string;
  metaId: string;
  metaTitulo: string;
  participantes: string[];
  questoes: DesempateQuestao[];
  resultados: Record<string, { score: number; nota: number }>;
  status: 'aberto' | 'encerrado';
  tenantId: string;
  createdAt: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const METRICA_CONFIG: Record<Metrica, { label: string; icon: string; color: string; desc: string }> = {
  media_quizzes:     { label: 'Média nos Quizzes',      icon: 'fa-clipboard-question', color: 'blue',    desc: 'Média percentual de todos os quizzes realizados'     },
  trilhas_concluidas:{ label: 'Trilhas Concluídas',     icon: 'fa-road',               color: 'teal',    desc: 'Número total de trilhas de aprendizado concluídas'   },
  exames_aprovados:  { label: 'Exames Aprovados',       icon: 'fa-file-pen',           color: 'purple',  desc: 'Número de exames com nota ≥ 70%'                    },
  total_pontos:      { label: 'Pontuação Total',        icon: 'fa-star',               color: 'amber',   desc: 'Quizzes (%) + Trilhas (×10) + Exames aprovados (×15)'},
};

const STATUS_CONFIG: Record<StatusMeta, { label: string; color: string; icon: string }> = {
  rascunho: { label: 'Rascunho', color: 'slate',   icon: 'fa-pencil'       },
  ativa:    { label: 'Ativa',    color: 'emerald',  icon: 'fa-circle-check' },
  encerrada:{ label: 'Encerrada',color: 'red',      icon: 'fa-lock'         },
};

function calcularRanking(
  metrica: Metrica,
  quizResults: QuizResult[],
  trilhasProgresso: TrilhaProgresso[],
  examesResultados: ExameResultado[]
): RankingItem[] {
  const usuarios: Record<string, { quizNotas: number[]; trilhas: number; exames: number }> = {};

  quizResults.forEach(r => {
    if (!usuarios[r.colaborador]) usuarios[r.colaborador] = { quizNotas: [], trilhas: 0, exames: 0 };
    usuarios[r.colaborador].quizNotas.push(r.nota);
  });

  trilhasProgresso.filter(t => t.concluida).forEach(t => {
    const nome = t.userName;
    if (!usuarios[nome]) usuarios[nome] = { quizNotas: [], trilhas: 0, exames: 0 };
    usuarios[nome].trilhas++;
  });

  examesResultados.filter(e => e.aprovado).forEach(e => {
    const nome = e.userName;
    if (!usuarios[nome]) usuarios[nome] = { quizNotas: [], trilhas: 0, exames: 0 };
    usuarios[nome].exames++;
  });

  return Object.entries(usuarios).map(([nome, dados]) => {
    const mediaQuiz = dados.quizNotas.length > 0
      ? Math.round(dados.quizNotas.reduce((a, b) => a + b, 0) / dados.quizNotas.length)
      : 0;

    let valor = 0;
    switch (metrica) {
      case 'media_quizzes':     valor = mediaQuiz; break;
      case 'trilhas_concluidas':valor = dados.trilhas; break;
      case 'exames_aprovados':  valor = dados.exames; break;
      case 'total_pontos':      valor = mediaQuiz + dados.trilhas * 10 + dados.exames * 15; break;
    }
    return { nome, valor, isPremiated: false, empatado: false };
  }).sort((a, b) => b.valor - a.valor);
}

function marcarPremiacaoEEmpate(ranking: RankingItem[], topN: number): RankingItem[] {
  if (ranking.length === 0) return ranking;
  const threshold = ranking[Math.min(topN, ranking.length) - 1]?.valor ?? 0;
  const empateNaBorda = ranking.filter(r => r.valor === threshold).length > 1
    && ranking.filter((_, i) => i < topN).some(r => r.valor === threshold)
    && ranking.filter((_, i) => i >= topN).some(r => r.valor === threshold);

  return ranking.map((r, i) => ({
    ...r,
    isPremiated: i < topN,
    empatado: empateNaBorda && r.valor === threshold,
  }));
}

// ─── Formulário de Meta ───────────────────────────────────────────────────────

const FormMeta: React.FC<{
  onSave: (data: Omit<Meta, 'id' | 'createdAt' | 'createdBy' | 'tenantId'>) => void;
  onCancel: () => void;
  initial?: Partial<Meta>;
}> = ({ onSave, onCancel, initial }) => {
  const [form, setForm] = useState({
    titulo:      initial?.titulo     ?? '',
    descricao:   initial?.descricao  ?? '',
    metrica:     (initial?.metrica   ?? 'media_quizzes') as Metrica,
    topN:        initial?.topN       ?? 3,
    premio:      initial?.premio     ?? '',
    dataInicio:  initial?.dataInicio ?? new Date().toISOString().split('T')[0],
    dataFim:     initial?.dataFim    ?? '',
    status:      (initial?.status    ?? 'ativa') as StatusMeta,
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-[#FBF7EE] border border-blue-500/30 rounded-2xl p-6 space-y-5">
      <h4 className="text-blue-400 font-black uppercase text-xs tracking-widest">
        {initial ? 'Editar Meta' : 'Nova Meta de Premiação'}
      </h4>

      {/* Titulo */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#5A6E8A]">Título da Meta *</label>
        <input value={form.titulo} onChange={e => set('titulo', e.target.value)}
          placeholder="Ex: Campeões do 2º Trimestre"
          className="w-full bg-slate-900 border border-[#E8D5A3] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500" />
      </div>

      {/* Descrição */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#5A6E8A]">Descrição</label>
        <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)}
          placeholder="Descreva os critérios e condições da premiação..."
          rows={2}
          className="w-full bg-slate-900 border border-[#E8D5A3] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 resize-none" />
      </div>

      {/* Métrica */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#5A6E8A]">Critério de Avaliação *</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(METRICA_CONFIG) as [Metrica, typeof METRICA_CONFIG[Metrica]][]).map(([key, cfg]) => (
            <button type="button" key={key} onClick={() => set('metrica', key)}
              className={`text-left p-3 rounded-xl border transition-all ${
                form.metrica === key
                  ? `border-${cfg.color}-500 bg-${cfg.color}-500/10`
                  : 'border-[#E8D5A3] hover:border-slate-600'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <i className={`fa-solid ${cfg.icon} text-xs ${form.metrica === key ? `text-${cfg.color}-400` : 'text-[#5A6E8A]'}`}></i>
                <p className={`text-xs font-black ${form.metrica === key ? `text-${cfg.color}-300` : 'text-white'}`}>{cfg.label}</p>
              </div>
              <p className="text-[9px] text-[#5A6E8A] leading-tight">{cfg.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top N */}
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-[#5A6E8A]">Top Premiados</label>
          <select value={form.topN} onChange={e => set('topN', Number(e.target.value))}
            className="w-full bg-slate-900 border border-[#E8D5A3] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500">
            {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </div>

        {/* Data Início */}
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-[#5A6E8A]">Data Início</label>
          <input type="date" value={form.dataInicio} onChange={e => set('dataInicio', e.target.value)}
            className="w-full bg-slate-900 border border-[#E8D5A3] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500" />
        </div>

        {/* Data Fim */}
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-[#5A6E8A]">Data Encerramento *</label>
          <input type="date" value={form.dataFim} onChange={e => set('dataFim', e.target.value)}
            className="w-full bg-slate-900 border border-[#E8D5A3] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500" />
        </div>
      </div>

      {/* Prêmio */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#5A6E8A]">Prêmio / Reconhecimento *</label>
        <input value={form.premio} onChange={e => set('premio', e.target.value)}
          placeholder="Ex: Voucher R$200, Folga extra, Certificado de Destaque..."
          className="w-full bg-slate-900 border border-[#E8D5A3] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500" />
      </div>

      {/* Status */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#5A6E8A]">Status</label>
        <select value={form.status} onChange={e => set('status', e.target.value as StatusMeta)}
          className="w-full bg-slate-900 border border-[#E8D5A3] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500">
          <option value="rascunho">Rascunho (não visível)</option>
          <option value="ativa">Ativa (visível a todos)</option>
          <option value="encerrada">Encerrada</option>
        </select>
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#8A9BB0] border border-[#E8D5A3] hover:border-slate-600 transition-all">
          Cancelar
        </button>
        <button
          onClick={() => {
            if (!form.titulo || !form.premio || !form.dataFim) return;
            onSave(form);
          }}
          disabled={!form.titulo || !form.premio || !form.dataFim}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
          <i className="fa-solid fa-floppy-disk mr-2"></i>Salvar Meta
        </button>
      </div>
    </div>
  );
};

// ─── Card de Meta com Ranking ─────────────────────────────────────────────────

const MetaCard: React.FC<{
  meta: Meta;
  ranking: RankingItem[];
  desempateSessions: DesempateSession[];
  isGestor: boolean;
  currentUserName: string;
  onEdit: () => void;
  onDelete: () => void;
  onIniciarDesempate: (participantes: string[]) => void;
  onEncerrar: () => void;
}> = ({ meta, ranking, desempateSessions, isGestor, currentUserName, onEdit, onDelete, onIniciarDesempate, onEncerrar }) => {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_CONFIG[meta.status];
  const mc = METRICA_CONFIG[meta.metrica];
  const marked = marcarPremiacaoEEmpate(ranking, meta.topN);
  const empate = marked.filter(r => r.empatado);
  const sessaoAberta = desempateSessions.find(s => s.metaId === meta.id && s.status === 'aberto');
  const meuRanking = marked.findIndex(r => r.nome === currentUserName);

  const diasRestantes = () => {
    if (!meta.dataFim) return null;
    const diff = new Date(meta.dataFim + 'T23:59:59').getTime() - Date.now();
    if (diff <= 0) return 'Encerrada';
    const dias = Math.ceil(diff / 86400000);
    return `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`;
  };

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${
      meta.status === 'ativa' ? 'border-blue-500/30' : 'border-[#E8D5A3]'
    }`}>
      {/* Header */}
      <div className="p-5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[9px] font-black uppercase tracking-widest bg-${sc.color}-500/10 text-${sc.color}-400 border border-${sc.color}-500/20 px-2 py-0.5 rounded-lg`}>
                <i className={`fa-solid ${sc.icon} mr-1`}></i>{sc.label}
              </span>
              <span className={`text-[9px] font-black uppercase tracking-widest bg-${mc.color}-500/10 text-${mc.color}-400 px-2 py-0.5 rounded-lg`}>
                <i className={`fa-solid ${mc.icon} mr-1`}></i>{mc.label}
              </span>
              {meta.status === 'ativa' && diasRestantes() && (
                <span className="text-[9px] font-black text-[#5A6E8A]">
                  <i className="fa-solid fa-clock mr-1"></i>{diasRestantes()}
                </span>
              )}
            </div>
            <h3 className="text-white font-black text-sm">{meta.titulo}</h3>
            {meta.descricao && <p className="text-[#5A6E8A] text-xs mt-0.5 line-clamp-1">{meta.descricao}</p>}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Prêmio badge */}
            <div className="hidden md:block text-right">
              <p className="text-[8px] text-[#5A6E8A] uppercase tracking-widest">Prêmio</p>
              <p className="text-xs font-black text-amber-400 flex items-center gap-1">
                <i className="fa-solid fa-trophy text-amber-400"></i>{meta.premio}
              </p>
            </div>

            {/* Minha posição */}
            {meuRanking >= 0 && (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                meuRanking < meta.topN ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-slate-800'
              }`}>
                <span className={`text-sm font-black ${meuRanking < meta.topN ? 'text-amber-400' : 'text-[#5A6E8A]'}`}>
                  #{meuRanking + 1}
                </span>
              </div>
            )}

            <i className={`fa-solid fa-chevron-down text-[#2C3E5A] text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}></i>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[#E8D5A3]/50 p-5 space-y-5">

          {/* Alerta de empate */}
          {empate.length > 0 && meta.status === 'ativa' && isGestor && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <i className="fa-solid fa-triangle-exclamation text-amber-400 text-lg mt-0.5 flex-shrink-0"></i>
              <div className="flex-1">
                <p className="text-amber-400 font-black text-sm">Empate detectado na posição premiada!</p>
                <p className="text-amber-600 text-xs mt-0.5">
                  {empate.map(r => r.nome).join(', ')} — {empate[0].valor} pontos cada
                </p>
                <p className="text-xs text-[#8A9BB0] mt-1">
                  Inicie o desempate com quiz de Taxonomia de Bloom Nível Alto (Avaliar/Criar).
                </p>
                {!sessaoAberta && (
                  <button
                    onClick={() => onIniciarDesempate(empate.map(r => r.nome))}
                    className="mt-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                    <i className="fa-solid fa-gavel mr-2"></i>Iniciar Desempate Bloom Alto
                  </button>
                )}
                {sessaoAberta && (
                  <div className="mt-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>Desempate em andamento
                    </p>
                    <p className="text-[#5A6E8A] text-[9px] mt-1">
                      Participantes: {sessaoAberta.participantes.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resultado de desempate encerrado */}
          {desempateSessions.filter(s => s.metaId === meta.id && s.status === 'encerrado').map(s => (
            <div key={s.id} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
              <p className="text-emerald-400 font-black text-xs uppercase tracking-widest">
                <i className="fa-solid fa-crown mr-2"></i>Resultado do Desempate
              </p>
              <div className="space-y-1">
                {Object.entries(s.resultados)
                  .sort(([, a], [, b]) => b.nota - a.nota)
                  .map(([nome, res], i) => (
                    <div key={nome} className="flex items-center justify-between">
                      <span className="text-xs text-white font-bold">
                        {i === 0 && <i className="fa-solid fa-trophy text-amber-400 mr-1.5"></i>}
                        {nome}
                      </span>
                      <span className={`text-xs font-black ${i === 0 ? 'text-amber-400' : 'text-[#5A6E8A]'}`}>
                        {res.nota}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* Ranking */}
          <div className="space-y-2">
            <h4 className="text-[9px] font-black text-[#5A6E8A] uppercase tracking-widest">
              Ranking — {mc.label}
            </h4>
            {marked.length === 0 ? (
              <p className="text-xs text-[#2C3E5A] italic">Nenhum dado disponível ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {marked.slice(0, 10).map((item, i) => {
                  const medalIcon  = i === 0 ? 'fa-trophy' : i === 1 ? 'fa-medal' : i === 2 ? 'fa-medal' : 'fa-hashtag';
                  const medalColor = i === 0 ? 'text-amber-400' : i === 1 ? 'text-[#1A2744]' : i === 2 ? 'text-amber-700' : 'text-[#2C3E5A]';
                  const isMe = item.nome === currentUserName;
                  return (
                    <div key={item.nome} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                      item.isPremiated ? 'bg-amber-500/5 border border-amber-500/20' :
                      isMe            ? 'bg-blue-500/5 border border-blue-500/20' :
                                        'bg-slate-900/30'
                    }`}>
                      <i className={`fa-solid ${medalIcon} text-sm w-5 text-center ${medalColor}`}></i>
                      <span className={`flex-1 text-sm font-bold truncate ${isMe ? 'text-blue-400' : 'text-white'}`}>
                        {item.nome}
                        {isMe && <span className="text-[9px] text-blue-500 ml-1.5 font-black uppercase">(você)</span>}
                      </span>
                      {item.empatado && (
                        <span className="text-[8px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                          Empate
                        </span>
                      )}
                      <span className={`text-sm font-black ${item.isPremiated ? 'text-amber-400' : 'text-[#8A9BB0]'}`}>
                        {item.valor}
                        {meta.metrica === 'media_quizzes' && '%'}
                      </span>
                      {item.isPremiated && (
                        <i className="fa-solid fa-gift text-amber-400 text-xs flex-shrink-0"></i>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prêmio info */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
            <i className="fa-solid fa-trophy text-amber-400 text-xl flex-shrink-0"></i>
            <div>
              <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Prêmio para o Top {meta.topN}</p>
              <p className="text-sm font-black text-white">{meta.premio}</p>
              {meta.dataFim && (
                <p className="text-[9px] text-[#5A6E8A] mt-0.5">
                  Até {new Date(meta.dataFim + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {/* Ações gestor */}
          {isGestor && (
            <div className="flex gap-2 flex-wrap border-t border-[#E8D5A3]/50 pt-4">
              {meta.status === 'ativa' && (
                <button onClick={onEncerrar}
                  className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-[#1A2744] transition-all">
                  <i className="fa-solid fa-lock mr-1"></i>Encerrar
                </button>
              )}
              <button onClick={onEdit}
                className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 transition-all">
                <i className="fa-solid fa-pen mr-1"></i>Editar
              </button>
              <button onClick={onDelete}
                className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all">
                <i className="fa-solid fa-trash mr-1"></i>Excluir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Tela de Desempate (colaborador responde) ─────────────────────────────────

const DesempatePlayer: React.FC<{
  sessao: DesempateSession;
  userName: string;
  onFinish: (sessaoId: string, score: number, nota: number) => void;
}> = ({ sessao, userName, onFinish }) => {
  const [fase, setFase] = useState<FaseDesempate>('respondendo');
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [resultado, setResultado] = useState<{ score: number; nota: number } | null>(null);

  const questao = sessao.questoes[idx];
  const total = sessao.questoes.length;

  const handleAnswer = (letra: string) => {
    setRespostas(prev => ({ ...prev, [idx]: letra }));
  };

  const handleEnviar = () => {
    let acertos = 0;
    sessao.questoes.forEach((q, i) => {
      if (respostas[i] === q.correta) acertos++;
    });
    const nota = Math.round((acertos / total) * 100);
    setResultado({ score: acertos, nota });
    setFase('resultado');
    onFinish(sessao.id, acertos, nota);
  };

  if (fase === 'resultado' && resultado) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
        <div className="bg-white border border-[#D4C5A0] rounded-2xl p-8 text-center max-w-md space-y-4">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${resultado.nota >= 70 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
            <i className={`fa-solid ${resultado.nota >= 70 ? 'fa-trophy' : 'fa-xmark'} text-3xl ${resultado.nota >= 70 ? 'text-emerald-400' : 'text-red-400'}`}></i>
          </div>
          <p className={`text-4xl font-black ${resultado.nota >= 70 ? 'text-emerald-400' : 'text-red-400'}`}>{resultado.nota}%</p>
          <p className="text-white font-black text-lg uppercase">Desempate concluído!</p>
          <p className="text-[#8A9BB0] text-sm">Seu resultado foi registrado. Aguarde a apuração final pelo gestor.</p>
          <div className="bg-slate-900 rounded-xl p-4 text-left space-y-1">
            <p className="text-[9px] font-black text-[#5A6E8A] uppercase tracking-widest">Gabarito rápido</p>
            {sessao.questoes.map((q, i) => {
              const acertou = respostas[i] === q.correta;
              return (
                <div key={i} className="flex items-center gap-2">
                  <i className={`fa-solid ${acertou ? 'fa-check text-emerald-400' : 'fa-xmark text-red-400'} text-xs`}></i>
                  <span className="text-xs text-[#8A9BB0] truncate">{q.enunciado.substring(0, 50)}...</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 overflow-y-auto">
      <div className="bg-white border border-amber-500/30 rounded-2xl w-full max-w-2xl space-y-5 p-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">
                <i className="fa-solid fa-gavel mr-1"></i>Desempate — {sessao.metaTitulo}
              </p>
              <p className="text-[9px] text-[#5A6E8A] mt-0.5">Taxonomia de Bloom Nível Alto • Avaliar / Criar</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-white">{Object.keys(respostas).length}<span className="text-[#2C3E5A]">/{total}</span></p>
              <p className="text-[9px] text-[#5A6E8A] uppercase">respondidas</p>
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div className="bg-amber-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(Object.keys(respostas).length / total) * 100}%` }}></div>
          </div>
        </div>

        {/* Questões */}
        <div className="space-y-4">
          {sessao.questoes.map((q, qi) => {
            const resp = respostas[qi];
            const bloomColor = q.bloom === 'avaliacao' ? 'purple' : 'pink';
            return (
              <div key={q.id} className={`bg-[#FBF7EE] border rounded-2xl p-5 space-y-3 ${resp ? 'border-amber-500/30' : 'border-[#E8D5A3]'}`}>
                <div className="flex items-start gap-3">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-${bloomColor}-500/20 text-${bloomColor}-400 flex-shrink-0 mt-0.5`}>
                    {q.bloom === 'avaliacao' ? 'Avaliar' : 'Criar'} • Bloom {q.bloom === 'avaliacao' ? 'Nível 5' : 'Nível 6'}
                  </span>
                  <p className="text-sm font-bold text-white leading-relaxed">
                    <span className="text-[#5A6E8A] mr-2">{qi + 1}.</span>{q.enunciado}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                  {q.alternativas.map(alt => (
                    <button key={alt.letra} type="button"
                      onClick={() => handleAnswer(alt.letra)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        resp === alt.letra
                          ? 'border-amber-500 bg-amber-500/20 text-white'
                          : 'border-[#E8D5A3] hover:border-slate-600 text-[#1A2744]'
                      }`}>
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        resp === alt.letra ? 'bg-amber-500 text-white' : 'bg-slate-800 text-[#8A9BB0]'
                      }`}>{alt.letra}</span>
                      <span className="text-xs leading-snug">{alt.texto}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleEnviar}
          disabled={Object.keys(respostas).length < total}
          className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-[#5A6E8A] text-white font-black uppercase tracking-widest rounded-2xl transition-all text-sm">
          <i className="fa-solid fa-gavel mr-2"></i>
          Enviar Respostas de Desempate
          {Object.keys(respostas).length < total && (
            <span className="ml-2 text-xs opacity-70">({total - Object.keys(respostas).length} restantes)</span>
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const MetasView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const user = state.user!;
  const tenantId = user.tenantId;
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(user.role);

  const [metas, setMetas] = useState<Meta[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [trilhasProgresso, setTrilhasProgresso] = useState<TrilhaProgresso[]>([]);
  const [examesResultados, setExamesResultados] = useState<ExameResultado[]>([]);
  const [desempateSessions, setDesempateSessions] = useState<DesempateSession[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [gerandoDesempate, setGerandoDesempate] = useState<string | null>(null); // metaId
  const [desempateAtivo, setDesempateAtivo] = useState<DesempateSession | null>(null);

  // Load data
  useEffect(() => {
    const q1 = query(collection(db, 'metas'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q1, s => setMetas(s.docs.map(d => ({ id: d.id, ...d.data() } as Meta))));

    const q2 = query(collection(db, 'treinamentosQuizResults'), orderBy('createdAt', 'desc'));
    const u2 = onSnapshot(q2, s => setQuizResults(s.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult))));

    const q3 = query(collection(db, 'trilhasProgresso'), where('tenantId', '==', tenantId));
    const u3 = onSnapshot(q3, s => setTrilhasProgresso(s.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaProgresso))));

    const q4 = query(collection(db, 'examesResultados'), where('tenantId', '==', tenantId));
    const u4 = onSnapshot(q4, s => setExamesResultados(s.docs.map(d => ({ id: d.id, ...d.data() } as ExameResultado))));

    const q5 = query(collection(db, 'metasDesempate'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const u5 = onSnapshot(q5, s => setDesempateSessions(s.docs.map(d => ({ id: d.id, ...d.data() } as DesempateSession))));

    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [tenantId]);

  // Verificar se há desempate ativo para o usuário atual
  useEffect(() => {
    const sessaoAtiva = desempateSessions.find(s =>
      s.status === 'aberto' &&
      s.participantes.includes(user.name) &&
      !s.resultados?.[user.name]
    );
    setDesempateAtivo(sessaoAtiva || null);
  }, [desempateSessions, user.name]);

  const handleSaveMeta = async (data: Omit<Meta, 'id' | 'createdAt' | 'createdBy' | 'tenantId'>) => {
    try {
      if (editingMeta) {
        await updateDoc(doc(db, 'metas', editingMeta.id), { ...data });
        showToast('Meta atualizada!', 'success');
      } else {
        await addDoc(collection(db, 'metas'), {
          ...data, tenantId, createdBy: user.id, createdAt: serverTimestamp()
        });
        showToast('Meta criada!', 'success');
      }
      setShowForm(false);
      setEditingMeta(null);
    } catch { showToast('Erro ao salvar meta.', 'error'); }
  };

  const handleDeleteMeta = async (id: string) => {
    if (!confirm('Excluir esta meta? Esta ação não pode ser desfeita.')) return;
    await deleteDoc(doc(db, 'metas', id));
    showToast('Meta excluída.', 'success');
  };

  const handleEncerrarMeta = async (id: string) => {
    await updateDoc(doc(db, 'metas', id), { status: 'encerrada' });
    showToast('Meta encerrada.', 'success');
  };

  // Gerar sessão de desempate com quiz Bloom Alto via Anthropic
  const handleIniciarDesempate = async (metaId: string, metaTitulo: string, participantes: string[]) => {
    setGerandoDesempate(metaId);
    try {
      const prompt = `Você é um especialista em avaliação educacional corporativa para serventias notariais.

Gere EXATAMENTE 5 questões de múltipla escolha de ALTO NÍVEL usando a Taxonomia de Bloom:
- 3 questões de AVALIAÇÃO (bloom: "avaliacao", Nível 5) — julgar, justificar, defender, criticar posições
- 2 questões de CRIAÇÃO (bloom: "criacao", Nível 6) — propor, elaborar, construir, formular soluções

Contexto: Meta de premiação "${metaTitulo}" em serventias notariais. 
As questões devem ser sobre boas práticas notariais, LGPD em cartórios, gestão de qualidade e conformidade com provimentos do CNJ.

REGRAS:
1. Cada questão tem exatamente 4 alternativas (A, B, C, D)
2. Apenas 1 alternativa correta
3. As questões devem exigir raciocínio complexo, análise crítica e síntese — não memorização simples
4. Justifique brevemente a resposta correta

Retorne APENAS um array JSON válido, sem markdown:
[{
  "id": 1,
  "enunciado": "texto da questão",
  "alternativas": [
    {"letra": "A", "texto": "..."},
    {"letra": "B", "texto": "..."},
    {"letra": "C", "texto": "..."},
    {"letra": "D", "texto": "..."}
  ],
  "correta": "A",
  "bloom": "avaliacao|criacao",
  "justificativa": "Explicação breve da resposta correta"
}]`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const raw = data.content?.[0]?.text || '';
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Resposta inválida da IA');
      const questoes: DesempateQuestao[] = JSON.parse(match[0]);

      await addDoc(collection(db, 'metasDesempate'), {
        metaId, metaTitulo, participantes,
        questoes, resultados: {}, status: 'aberto',
        tenantId, createdAt: serverTimestamp()
      });

      showToast(`Desempate criado com ${questoes.length} questões Bloom Alto!`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao gerar desempate.', 'error');
    } finally {
      setGerandoDesempate(null);
    }
  };

  // Registrar resultado do desempate
  const handleDesempateFinish = async (sessaoId: string, score: number, nota: number) => {
    try {
      const sessao = desempateSessions.find(s => s.id === sessaoId);
      if (!sessao) return;

      const novosResultados = { ...sessao.resultados, [user.name]: { score, nota } };
      const todosResponderam = sessao.participantes.every(p => novosResultados[p]);

      await updateDoc(doc(db, 'metasDesempate', sessaoId), {
        [`resultados.${user.name}`]: { score, nota },
        ...(todosResponderam ? { status: 'encerrado' } : {})
      });

      if (todosResponderam) {
        showToast('Todos responderam! Desempate encerrado.', 'success');
      } else {
        showToast('Resposta registrada. Aguardando os demais participantes.', 'success');
      }
    } catch { showToast('Erro ao registrar resultado.', 'error'); }
  };

  // Rankings por meta
  const getRanking = (meta: Meta) => calcularRanking(meta.metrica, quizResults, trilhasProgresso, examesResultados);

  // Stats
  const ativas = metas.filter(m => m.status === 'ativa').length;
  const encerradas = metas.filter(m => m.status === 'encerrada').length;
  const minhasMelhorias = metas.filter(m => {
    const r = marcarPremiacaoEEmpate(getRanking(m), m.topN);
    const pos = r.findIndex(x => x.nome === user.name);
    return pos >= 0 && pos < m.topN;
  }).length;

  return (
    <div className="p-8 space-y-6 bg-[#FBF7EE] min-h-screen animate-in fade-in">

      {/* Desempate ativo — modal */}
      {desempateAtivo && (
        <DesempatePlayer
          sessao={desempateAtivo}
          userName={user.name}
          onFinish={handleDesempateFinish}
        />
      )}

      {/* Alerta de desempate pendente */}
      {desempateAtivo && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
            <i className="fa-solid fa-gavel text-amber-400"></i>
          </div>
          <div>
            <p className="text-amber-400 font-black text-sm">Desempate aguardando sua resposta!</p>
            <p className="text-xs text-[#8A9BB0]">Meta: {desempateAtivo.metaTitulo}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
            Metas de <span className="text-amber-500">Premiação</span>
          </h2>
          <p className="text-[#5A6E8A] text-[10px] font-black uppercase tracking-[0.3em]">
            Objetivos · Rankings · Desempate Bloom Alto
          </p>
        </div>
        {isGestor && !showForm && (
          <button onClick={() => { setShowForm(true); setEditingMeta(null); }}
            className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
            <i className="fa-solid fa-plus"></i>Nova Meta
          </button>
        )}
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Metas Ativas',      value: ativas,        icon: 'fa-bullseye',      color: 'emerald' },
          { label: 'Encerradas',        value: encerradas,    icon: 'fa-flag-checkered', color: 'slate'   },
          { label: 'Estou Premiado',    value: minhasMelhorias, icon: 'fa-trophy',       color: 'amber'   },
          { label: 'Total de Metas',    value: metas.length,  icon: 'fa-list-check',    color: 'blue'    },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-[#E8D5A3] rounded-[20px] p-5 space-y-2">
            <i className={`fa-solid ${s.icon} text-${s.color}-500`}></i>
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-[9px] text-[#5A6E8A] font-black uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Formulário */}
      {showForm && (
        <FormMeta
          initial={editingMeta ?? undefined}
          onSave={handleSaveMeta}
          onCancel={() => { setShowForm(false); setEditingMeta(null); }}
        />
      )}

      {/* Aviso sobre Bloom Alto */}
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 flex items-start gap-3">
        <i className="fa-solid fa-brain text-purple-400 text-lg mt-0.5 flex-shrink-0"></i>
        <div>
          <p className="text-purple-400 font-black text-xs uppercase tracking-widest">Desempate por Bloom Alto</p>
          <p className="text-xs text-[#8A9BB0] mt-0.5 leading-relaxed">
            Em caso de empate na posição premiada, o gestor pode iniciar um quiz de desempate com questões de 
            <strong className="text-white"> Nível 5 (Avaliar)</strong> e <strong className="text-white">Nível 6 (Criar)</strong> da Taxonomia de Bloom — 
            exigindo raciocínio crítico e elaboração de soluções, não apenas memorização.
          </p>
        </div>
      </div>

      {/* Lista de Metas */}
      {metas.length === 0 ? (
        <div className="bg-white border border-[#E8D5A3] rounded-2xl p-12 text-center">
          <i className="fa-solid fa-trophy text-5xl text-[#1A2744] mb-4 block"></i>
          <p className="text-[#2C3E5A] text-xs font-bold uppercase tracking-widest">Nenhuma meta criada ainda</p>
          {isGestor && (
            <p className="text-[#1A2744] text-xs mt-1">Clique em "Nova Meta" para criar a primeira meta de premiação</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Ativas primeiro */}
          {metas.filter(m => m.status === 'ativa').length > 0 && (
            <div className="space-y-3">
              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest px-1">
                <i className="fa-solid fa-circle-check mr-1.5"></i>Metas Ativas
              </p>
              {metas.filter(m => m.status === 'ativa').map(meta => (
                <MetaCard
                  key={meta.id}
                  meta={meta}
                  ranking={getRanking(meta)}
                  desempateSessions={desempateSessions.filter(s => s.metaId === meta.id)}
                  isGestor={isGestor}
                  currentUserName={user.name}
                  onEdit={() => { setEditingMeta(meta); setShowForm(true); }}
                  onDelete={() => handleDeleteMeta(meta.id)}
                  onEncerrar={() => handleEncerrarMeta(meta.id)}
                  onIniciarDesempate={(participantes) => {
                    if (gerandoDesempate) return;
                    handleIniciarDesempate(meta.id, meta.titulo, participantes);
                  }}
                />
              ))}
            </div>
          )}

          {/* Rascunhos */}
          {isGestor && metas.filter(m => m.status === 'rascunho').length > 0 && (
            <div className="space-y-3">
              <p className="text-[9px] font-black text-[#5A6E8A] uppercase tracking-widest px-1">
                <i className="fa-solid fa-pencil mr-1.5"></i>Rascunhos
              </p>
              {metas.filter(m => m.status === 'rascunho').map(meta => (
                <MetaCard
                  key={meta.id}
                  meta={meta}
                  ranking={getRanking(meta)}
                  desempateSessions={desempateSessions.filter(s => s.metaId === meta.id)}
                  isGestor={isGestor}
                  currentUserName={user.name}
                  onEdit={() => { setEditingMeta(meta); setShowForm(true); }}
                  onDelete={() => handleDeleteMeta(meta.id)}
                  onEncerrar={() => handleEncerrarMeta(meta.id)}
                  onIniciarDesempate={(participantes) => handleIniciarDesempate(meta.id, meta.titulo, participantes)}
                />
              ))}
            </div>
          )}

          {/* Encerradas */}
          {metas.filter(m => m.status === 'encerrada').length > 0 && (
            <div className="space-y-3">
              <p className="text-[9px] font-black text-[#2C3E5A] uppercase tracking-widest px-1">
                <i className="fa-solid fa-lock mr-1.5"></i>Encerradas
              </p>
              {metas.filter(m => m.status === 'encerrada').map(meta => (
                <MetaCard
                  key={meta.id}
                  meta={meta}
                  ranking={getRanking(meta)}
                  desempateSessions={desempateSessions.filter(s => s.metaId === meta.id)}
                  isGestor={isGestor}
                  currentUserName={user.name}
                  onEdit={() => { setEditingMeta(meta); setShowForm(true); }}
                  onDelete={() => handleDeleteMeta(meta.id)}
                  onEncerrar={() => {}}
                  onIniciarDesempate={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overlay de geração de desempate */}
      {gerandoDesempate && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center">
          <div className="bg-white border border-amber-500/30 rounded-2xl p-8 text-center space-y-4 max-w-sm">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto animate-pulse">
              <i className="fa-solid fa-brain text-amber-400 text-2xl"></i>
            </div>
            <p className="text-white font-black text-sm uppercase tracking-widest">Gerando Quiz de Desempate</p>
            <p className="text-[#5A6E8A] text-xs">Criando questões Bloom Nível 5-6 com IA...</p>
            <div className="flex gap-1 justify-center">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetasView;
