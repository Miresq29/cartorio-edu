import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { GeminiService } from '../../services/geminiService';
import TrainingParticipants from './TrainingParticipants';
import TrainingQuiz from './TrainingQuiz';
import TrainingReport from './TrainingReport';

interface TrainingMessage { role: 'user' | 'ai'; text: string; }

type Tab = 'ia' | 'participantes' | 'questionarios' | 'relatorios';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'ia',            icon: 'fa-wand-magic-sparkles', label: 'IA de Treinamento' },
  { id: 'participantes', icon: 'fa-users',               label: 'Participantes'     },
  { id: 'questionarios', icon: 'fa-circle-question',     label: 'Questionários'     },
  { id: 'relatorios',    icon: 'fa-file-chart-column',   label: 'Relatórios'        },
];

const TrainingView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('ia');
  const [checklists, setChecklists] = useState<any[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<any[]>([]);
  const [messages, setMessages] = useState<TrainingMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q1 = query(collection(db, 'checklists'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q1, s => setChecklists(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const q2 = query(collection(db, 'knowledgeBase'), orderBy('createdAt', 'desc'));
    const u2 = onSnapshot(q2, s => setKnowledgeDocs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const totalItems = checklists.reduce((acc, c) => acc + (c.items?.length || 0), 0);

  const buildContext = () => {
    const cl = checklists.map(c => `PROTOCOLO: ${c.title}\nITENS: ${c.items?.map((i: any) => i.text).join('; ')}`).join('\n\n');
    const kl = knowledgeDocs.slice(0, 5).map(d => `DOCUMENTO: ${d.fileName || d.title}\nCONTEÚDO: ${d.content?.substring(0, 500)}`).join('\n\n');
    return `Você é um especialista em treinamento notarial da MJ Consultoria.\nBASE LEGAL:\n${kl || 'Nenhum documento.'}\nPROTOCOLOS:\n${cl || 'Nenhum protocolo.'}\nUnidade: ${state.user?.tenantId || 'MJ Consultoria'} | Operador: ${state.user?.name || 'Usuário'}`;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const msg = input.trim(); setInput('');
    setMessages(p => [...p, { role: 'user', text: msg }]);
    setIsLoading(true);
    try {
      const r = await GeminiService.chat(`${buildContext()}\n\nPergunta: ${msg}`, '', state.token || '');
      setMessages(p => [...p, { role: 'ai', text: typeof r === 'string' ? r : (r as any).text || 'Sem resposta.' }]);
    } catch { showToast('Erro ao consultar IA.', 'error'); } finally { setIsLoading(false); }
  };

  const suggestTraining = async () => {
    setIsLoading(true);
    setMessages(p => [...p, { role: 'user', text: 'Analise nossa base e sugira um roteiro de treinamento prioritário.' }]);
    try {
      const r = await GeminiService.chat(`${buildContext()}\n\nCrie um roteiro de treinamento detalhado e priorizado. Inclua: módulos, objetivos, duração estimada e justificativa.`, '', state.token || '');
      setMessages(p => [...p, { role: 'ai', text: typeof r === 'string' ? r : (r as any).text || 'Sem resposta.' }]);
    } catch { showToast('Erro ao gerar sugestão.', 'error'); } finally { setIsLoading(false); }
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'ia':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-white font-black uppercase italic text-sm">IA de Treinamento MJ</h3>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Roteiros baseados na sua base de conhecimento</p>
              </div>
              <button onClick={suggestTraining} disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Sugerir Treinamento
              </button>
            </div>

            {(checklists.length > 0 || knowledgeDocs.length > 0) && (
              <div className="bg-[#05080f] border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Base Ativa</h4>
                {checklists.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-xl">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-slate-300"><span className="font-bold text-white">{c.title}</span> — {c.items?.length || 0} requisitos</span>
                  </div>
                ))}
                {knowledgeDocs.slice(0, 2).map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-xl">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-xs text-slate-300"><span className="font-bold text-white">{d.fileName || d.title}</span> — documento indexado</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#05080f] border border-slate-800 rounded-2xl overflow-hidden">
              <div className="h-80 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <i className="fa-solid fa-graduation-cap text-5xl text-slate-600 mb-4"></i>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Clique em "Sugerir Treinamento" ou faça uma pergunta</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-5 py-4 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 border border-slate-700 px-5 py-4 rounded-2xl">
                      <i className="fa-solid fa-circle-notch animate-spin text-blue-500"></i>
                      <span className="text-xs text-slate-400 ml-2">IA processando...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 border-t border-slate-800 flex gap-3">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ex: Crie um treinamento sobre escrituras públicas..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500" />
                <button onClick={handleSend} disabled={isLoading || !input.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50">
                  <i className="fa-solid fa-paper-plane"></i>
                </button>
              </div>
            </div>
          </div>
        );

      case 'participantes':
        return <TrainingParticipants />;

      case 'questionarios':
        return <TrainingQuiz checklists={checklists} />;

      case 'relatorios':
        return <TrainingReport />;

      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-6 bg-[#05080f] min-h-screen animate-in fade-in">

      <header>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Centro de <span className="text-blue-500">Treinamento</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">MJ Consultoria // Capacitação Notarial IA</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Protocolos Ativos',  value: checklists.length,   icon: 'fa-clipboard-check', color: 'blue'    },
          { label: 'Itens de Checklist', value: totalItems,           icon: 'fa-list-check',      color: 'emerald' },
          { label: 'Docs na Base Legal', value: knowledgeDocs.length, icon: 'fa-scale-balanced',  color: 'amber'   },
          { label: 'Cobertura Estimada', value: `${Math.min(100, checklists.length * 12 + knowledgeDocs.length * 8)}%`, icon: 'fa-chart-pie', color: 'purple' },
        ].map((s, i) => (
          <div key={i} className="bg-[#0a111f] border border-slate-800 rounded-[24px] p-6 space-y-3">
            <i className={`fa-solid ${s.icon} text-${s.color}-500 text-xl`}></i>
            <p className="text-3xl font-black text-white">{s.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#0a111f] border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">
        <div className="flex border-b border-slate-800 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/50'
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