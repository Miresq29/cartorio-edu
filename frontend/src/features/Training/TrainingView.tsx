import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { GeminiService } from '../../services/geminiService';
import TrainingParticipants from './TrainingParticipants';
import TrainingQuiz from './TrainingQuiz';
import TrainingReport from './TrainingReport';
import TrainingDashboard from './TrainingDashboard';

interface TrainingMessage { role: 'user' | 'ai'; text: string; }

type Tab = 'ia' | 'resumos' | 'participantes' | 'questionarios' | 'relatorios' | 'dashboard';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'ia',            icon: 'fa-wand-magic-sparkles', label: 'IA de Treinamento' },
  { id: 'resumos',       icon: 'fa-file-lines',          label: 'Resumos'           },
  { id: 'participantes', icon: 'fa-users',               label: 'Participantes'     },
  { id: 'questionarios', icon: 'fa-circle-question',     label: 'Questionários'     },
  { id: 'relatorios',    icon: 'fa-file-chart-column',   label: 'Relatórios'        },
  { id: 'dashboard',     icon: 'fa-chart-pie',           label: 'Dashboard Gestão'  },
];

type SummaryType = 'executivo' | 'tecnico' | 'didatico' | 'operacional';

const SUMMARY_TYPES: { id: SummaryType; label: string; desc: string; color: string }[] = [
  { id: 'executivo',   label: 'Executivo',   desc: 'Para gestores — pontos-chave e impactos',    color: 'blue'    },
  { id: 'tecnico',     label: 'Técnico',     desc: 'Fundamentos legais e análise normativa',      color: 'purple'  },
  { id: 'didatico',    label: 'Didático',    desc: 'Para treinamento — exemplos práticos',        color: 'emerald' },
  { id: 'operacional', label: 'Operacional', desc: 'Procedimentos e passo a passo do dia a dia', color: 'amber'   },
];

interface TrainingOption {
  titulo: string;
  tipo: 'essencial' | 'completo' | 'relampago';
  descricao: string;
  duracao: string;
  publico: string;
  modulos: { nome: string; objetivo: string; duracao: string; obrigatorio: boolean }[];
  justificativa: string;
}

interface Trilha {
  id: string;
  titulo: string;
  descricao: string;
  perfis: string[];
  modulos: { id: string; titulo: string; descricao: string; conteudo: string; tipo: string }[];
  ativa: boolean;
  tenantId: string;
}

const TIPO_COLOR: Record<string, string> = {
  essencial: 'blue',
  completo:  'emerald',
  relampago: 'amber',
};

const TIPO_ICON: Record<string, string> = {
  essencial: 'fa-seedling',
  completo:  'fa-layer-group',
  relampago: 'fa-bolt',
};

const TrainingView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('ia');
  const [checklists, setChecklists] = useState<any[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [filtroTrilha, setFiltroTrilha] = useState<Trilha | null>(null);

  // IA de Treinamento
  const [messages, setMessages] = useState<TrainingMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [trainingOptions, setTrainingOptions] = useState<TrainingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<TrainingOption | null>(null);
  const [customRequest, setCustomRequest] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Resumos
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [summaryType, setSummaryType] = useState<SummaryType>('executivo');
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    const q1 = query(collection(db, 'checklists'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q1, s => setChecklists(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const q2 = query(collection(db, 'knowledgeBase'), orderBy('createdAt', 'desc'));
    const u2 = onSnapshot(q2, s => setKnowledgeDocs(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const tenantId = state.user?.tenantId;
    const role = state.user?.role;
    let q3;
    if (tenantId) {
      q3 = query(collection(db, 'trilhas'), where('tenantId', '==', tenantId));
    } else {
      q3 = query(collection(db, 'trilhas'));
    }
    const u3 = onSnapshot(q3, s => {
      const all = s.docs.map(d => ({ id: d.id, ...d.data() } as Trilha)).filter(t => t.ativa !== false);
      const mine = role === 'SUPERADMIN' ? all : all.filter(t => !t.perfis || t.perfis.length === 0 || t.perfis.includes(role || ''));
      setTrilhas(mine);
    });

    return () => { u1(); u2(); u3(); };
  }, [state.user?.tenantId, state.user?.role]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const totalItems = checklists.reduce((acc, c) => acc + (c.items?.length || 0), 0);

  const buildContext = () => {
    const cl = checklists.map(c => `PROTOCOLO: ${c.title}\nITENS: ${c.items?.map((i: any) => i.text).join('; ')}`).join('\n\n');
    const kl = knowledgeDocs.slice(0, 8).map(d => `DOCUMENTO: ${d.fileName || d.title}\nCONTEÚDO: ${d.content?.substring(0, 800)}`).join('\n\n');

    let trilhaCtx = '';
    if (filtroTrilha) {
      const mods = filtroTrilha.modulos?.map(m => `MÓDULO: ${m.titulo}\n${m.descricao}\n${m.conteudo?.substring(0, 400)}`).join('\n\n') || '';
      trilhaCtx = `\n\nTRILHA SELECIONADA: ${filtroTrilha.titulo}\n${filtroTrilha.descricao}\n${mods}`;
    }

    return `Você é um especialista em treinamento notarial da MJ Consultoria.\nBASE LEGAL:\n${kl || 'Nenhum documento.'}\nPROTOCOLOS:\n${cl || 'Nenhum protocolo.'}${trilhaCtx}\nUnidade: ${state.user?.tenantId || 'MJ Consultoria'} | Operador: ${state.user?.name || 'Usuário'}`;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const msg = input.trim(); setInput('');
    setMessages(p => [...p, { role: 'user', text: msg }]);
    setIsLoading(true);
    setTrainingOptions([]);
    setSelectedOption(null);
    try {
      const r = await GeminiService.chat(`${buildContext()}\n\nPergunta: ${msg}`, '', state.token || '');
      setMessages(p => [...p, { role: 'ai', text: typeof r === 'string' ? r : (r as any).text || 'Sem resposta.' }]);
    } catch (e: any) { showToast(e?.message || 'Erro ao consultar IA.', 'error'); } finally { setIsLoading(false); }
  };

  const generateOptions = async () => {
    setIsLoading(true);
    setTrainingOptions([]);
    setSelectedOption(null);
    setMessages([]);
    const trilhaHint = filtroTrilha ? `Trilha: ${filtroTrilha.titulo}. ` : '';
    try {
      const options = await GeminiService.generateTrainingOptions(buildContext(), trilhaHint + (customRequest || undefined!));
      if (options && options.length > 0) {
        setTrainingOptions(options);
        showToast('3 opções de roteiro geradas! Escolha uma para expandir.', 'success');
      } else {
        showToast('Não foi possível gerar opções. Tente novamente.', 'error');
      }
    } catch (e: any) { showToast(e?.message || 'Erro ao gerar opções de treinamento.', 'error'); } finally { setIsLoading(false); }
  };

  const selectOption = async (option: TrainingOption) => {
    setSelectedOption(option);
    setTrainingOptions([]);
    setMessages([{ role: 'ai', text: formatSelectedOption(option) }]);
  };

  const formatSelectedOption = (opt: TrainingOption): string => {
    const modulos = opt.modulos?.map((m, i) =>
      `  ${i + 1}. ${m.nome} (${m.duracao})${m.obrigatorio ? ' ★' : ''}\n     Objetivo: ${m.objetivo}`
    ).join('\n') || 'Módulos não especificados';
    return `ROTEIRO: ${opt.titulo.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Abordagem: ${opt.descricao}
Duração total: ${opt.duracao}
Público-alvo: ${opt.publico}

MÓDULOS:
${modulos}

JUSTIFICATIVA:
${opt.justificativa}

★ = Módulo obrigatório
`;
  };

  const generateSummary = async () => {
    if (!selectedDoc) { showToast('Selecione um documento da base legal.', 'error'); return; }
    setSummaryLoading(true);
    setSummary('');
    try {
      const result = await GeminiService.generateSummary(
        selectedDoc.content || selectedDoc.rawText || '',
        selectedDoc.fileName || selectedDoc.title || 'Documento',
        summaryType
      );
      setSummary(result);
    } catch (e: any) { showToast(e?.message || 'Erro ao gerar resumo.', 'error'); } finally { setSummaryLoading(false); }
  };

  const renderTrilhaSelector = () => {
    if (trilhas.length === 0) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <i className="fa-solid fa-road text-teal-500"></i>
            Filtrar por Trilha
          </h4>
          {filtroTrilha && (
            <button type="button" onClick={() => setFiltroTrilha(null)}
              className="text-[9px] text-slate-400 hover:text-slate-600 font-bold underline">
              Limpar filtro
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {trilhas.map(t => (
            <button key={t.id} type="button"
              onClick={() => setFiltroTrilha(filtroTrilha?.id === t.id ? null : t)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${
                filtroTrilha?.id === t.id
                  ? 'bg-teal-500 text-white border-teal-500'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-400 hover:text-teal-600'
              }`}>
              {t.titulo}
            </button>
          ))}
        </div>
        {filtroTrilha && (
          <p className="text-[10px] text-teal-600 font-semibold">
            <i className="fa-solid fa-circle-info mr-1"></i>
            Treinamento contextualizado para a trilha: <strong>{filtroTrilha.titulo}</strong>
          </p>
        )}
      </div>
    );
  };

  const renderIATab = () => (
    <div className="space-y-4">
      {renderTrilhaSelector()}

      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-[#0A1628] font-black uppercase italic text-sm">IA de Treinamento MJ</h3>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Gere 3 opções de roteiro e escolha a melhor para sua equipe</p>
        </div>
        <button type="button" onClick={generateOptions} disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex-shrink-0">
          <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
          {isLoading ? 'Gerando...' : 'Gerar 3 Opções'}
        </button>
      </div>

      {/* Campo para pedido específico */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
          Personalizar pedido (opcional)
        </label>
        <input
          value={customRequest}
          onChange={e => setCustomRequest(e.target.value)}
          placeholder="Ex: foco em escrituras públicas, para atendentes novos, duração máxima 2 horas..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500 placeholder:text-slate-400"
        />
      </div>

      {/* Base ativa */}
      {(checklists.length > 0 || knowledgeDocs.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Base Ativa</h4>
          {checklists.slice(0, 3).map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-slate-600"><span className="font-bold text-[#0A1628]">{c.title}</span> — {c.items?.length || 0} requisitos</span>
            </div>
          ))}
          {knowledgeDocs.slice(0, 3).map((d, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-xs text-slate-600"><span className="font-bold text-[#0A1628]">{d.fileName || d.title}</span> — documento indexado</span>
            </div>
          ))}
        </div>
      )}

      {/* Cards de opções */}
      {trainingOptions.length > 0 && (
        <div className="space-y-3">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Escolha uma opção para expandir o roteiro completo:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trainingOptions.map((opt, i) => {
              const color = TIPO_COLOR[opt.tipo] || 'blue';
              const icon  = TIPO_ICON[opt.tipo]  || 'fa-graduation-cap';
              return (
                <button type="button" key={i} onClick={() => selectOption(opt)}
                  className={`text-left bg-white border border-${color}-500/30 hover:border-${color}-500 rounded-2xl p-5 space-y-3 transition-all hover:bg-${color}-50 group shadow-sm`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-${color}-100 flex items-center justify-center`}>
                      <i className={`fa-solid ${icon} text-${color}-600 text-sm`}></i>
                    </div>
                    <div>
                      <p className={`text-[9px] font-black uppercase tracking-widest text-${color}-600`}>{opt.tipo}</p>
                      <p className="text-sm font-black text-[#0A1628] leading-tight">{opt.titulo}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{opt.descricao}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-bold">
                      <i className="fa-solid fa-clock mr-1"></i>{opt.duracao}
                    </span>
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-bold">
                      <i className="fa-solid fa-users mr-1"></i>{opt.publico}
                    </span>
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-bold">
                      <i className="fa-solid fa-list-check mr-1"></i>{opt.modulos?.length || 0} módulos
                    </span>
                  </div>
                  <p className={`text-[9px] font-black text-${color}-600 uppercase tracking-widest group-hover:underline`}>
                    Selecionar este roteiro →
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat de resultado */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="h-80 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
          {messages.length === 0 && trainingOptions.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <i className="fa-solid fa-graduation-cap text-5xl text-slate-400 mb-4"></i>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                Clique em "Gerar 3 Opções" ou faça uma pergunta
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-5 py-4 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-[#0A1628] border border-slate-200 shadow-sm'
              }`}>
                <p className="whitespace-pre-wrap font-mono text-xs">{m.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 px-5 py-4 rounded-2xl shadow-sm">
                <i className="fa-solid fa-circle-notch animate-spin text-blue-500"></i>
                <span className="text-xs text-slate-500 ml-2">IA gerando opções de roteiro...</span>
              </div>
            </div>
          )}
          {selectedOption && messages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={generateOptions} disabled={isLoading}
                className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all border border-slate-200">
                <i className="fa-solid fa-rotate mr-1"></i>Gerar novas opções
              </button>
              <button type="button" onClick={() => { navigator.clipboard.writeText(messages[messages.length - 1]?.text || ''); showToast('Roteiro copiado!', 'success'); }}
                className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all border border-slate-200">
                <i className="fa-solid fa-copy mr-1"></i>Copiar roteiro
              </button>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-4 border-t border-slate-200 flex gap-3 bg-white">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ex: Adapte o roteiro para apenas atendentes de balcão..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500 placeholder:text-slate-400" />
          <button type="button" onClick={handleSend} disabled={isLoading || !input.trim()}
            title="Enviar mensagem"
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50">
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );

  const renderResumosTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-[#0A1628] font-black uppercase italic text-sm">Resumos Inteligentes</h3>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Escolha um documento e o tipo de resumo desejado</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coluna esquerda: seleção */}
        <div className="space-y-4">
          {/* 1. Seleção de documento */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">1. Selecione o documento</h4>
            {knowledgeDocs.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhum documento na base legal. Adicione documentos na seção "Base Legal".</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
                {knowledgeDocs.map((doc, i) => (
                  <button type="button" key={i} onClick={() => setSelectedDoc(doc)}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${
                      selectedDoc?.id === doc.id
                        ? 'border-blue-500 bg-blue-50 text-[#0A1628]'
                        : 'border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50/50 text-[#0A1628]'
                    }`}>
                    <p className="text-xs font-bold truncate">{doc.fileName || doc.title}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">{doc.content?.length || 0} caracteres indexados</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Seleção de tipo */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">2. Tipo de resumo</h4>
            <div className="grid grid-cols-2 gap-2">
              {SUMMARY_TYPES.map(st => (
                <button type="button" key={st.id} onClick={() => setSummaryType(st.id)}
                  className={`p-3 rounded-xl text-left transition-all border ${
                    summaryType === st.id
                      ? `border-${st.color}-500 bg-${st.color}-50`
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}>
                  <p className={`text-xs font-black ${summaryType === st.id ? `text-${st.color}-700` : 'text-[#0A1628]'}`}>{st.label}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{st.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={generateSummary} disabled={summaryLoading || !selectedDoc}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            {summaryLoading
              ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Gerando resumo...</>
              : <><i className="fa-solid fa-file-lines mr-2"></i>Gerar Resumo</>
            }
          </button>
        </div>

        {/* Coluna direita: resultado */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 min-h-[350px] flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Resultado</h4>
            {summary && (
              <button type="button" onClick={() => { navigator.clipboard.writeText(summary); showToast('Resumo copiado!', 'success'); }}
                className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest transition-all border border-slate-200">
                <i className="fa-solid fa-copy mr-1"></i>Copiar
              </button>
            )}
          </div>
          {summaryLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <i className="fa-solid fa-circle-notch animate-spin text-emerald-500 text-2xl"></i>
                <p className="text-xs text-slate-500">Analisando documento...</p>
              </div>
            </div>
          ) : summary ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <p className="text-xs text-[#0A1628] whitespace-pre-wrap leading-relaxed">{summary}</p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center opacity-40">
              <div className="text-center space-y-2">
                <i className="fa-solid fa-file-lines text-4xl text-slate-400"></i>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Selecione um documento e gere o resumo</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'ia':           return renderIATab();
      case 'resumos':      return renderResumosTab();
      case 'participantes': return <TrainingParticipants />;
      case 'questionarios': return <TrainingQuiz checklists={checklists} />;
      case 'relatorios':   return <TrainingReport />;
      case 'dashboard':    return <TrainingDashboard />;
      default:             return null;
    }
  };

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">

      <header>
        <h2 className="text-3xl font-black text-[#0D1B3E] italic uppercase tracking-tighter">
          Centro de <span className="text-blue-500">Treinamento</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">MJ Consultoria // Capacitação Notarial IA</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Protocolos Ativos',  value: checklists.length,   icon: 'fa-clipboard-check', color: 'blue'    },
          { label: 'Itens de Checklist', value: totalItems,           icon: 'fa-list-check',      color: 'emerald' },
          { label: 'Docs na Base Legal', value: knowledgeDocs.length, icon: 'fa-scale-balanced',  color: 'amber'   },
          { label: 'Trilhas Ativas',     value: trilhas.length,       icon: 'fa-road',            color: 'teal'    },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-3">
            <i className={`fa-solid ${s.icon} text-${s.color}-500 text-xl`}></i>
            <p className="text-3xl font-black text-[#0A1628]">{s.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {TABS.map(tab => (
            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-500 bg-blue-50'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <i className={`fa-solid ${tab.icon} text-xs`}></i>{tab.label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {renderTab()}
        </div>
      </div>
    </div>
  );
};

export default TrainingView;
