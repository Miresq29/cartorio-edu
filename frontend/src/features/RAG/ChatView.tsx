
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAudit } from '../../hooks/useAudit';
import { GeminiService } from '../../services/geminiService';
import { searchKB, buildRAGContext } from '../../services/ragEngine';

const ChatView: React.FC = () => {
  const { state } = useApp();
  const { logAction } = useAudit();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const userToken = state?.token;
    if (!input.trim() || !userToken) return;

    const query = input;
    setInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: query }]);
    setIsTyping(true);

    try {
      const docs = (state as any).knowledgeBase || [];
      const searchResults = searchKB(query, docs);
      const context = buildRAGContext(searchResults);

      const response = await GeminiService.chat(query, context, userToken);
      
      const answerText = typeof response === 'string' ? response : (response as any).text || "Sem resposta da IA.";
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: answerText }]);
      
      if (logAction) {
        logAction('CHAT_QUERY', `Consulta: ${query.substring(0, 30)}...`, 'SYSTEM');
      }
    } catch (error: any) {
      console.error("Erro no Chat:", error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: "⚠️ Erro: Falha na conexão com a base legal." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1B3E] m-4 rounded-3xl border border-[#C9A84C]/30 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#C9A84C]/30 bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl">
            ✨
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">IA Notarial</h2>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Base Legal Ativa</p>
          </div>
        </div>
        <div className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-md border border-emerald-500/20 uppercase tracking-widest">
          Unidade: {state?.user?.tenantId || 'MJ-GLOBAL'}
        </div>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-grid-white/[0.02]">
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-50">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-white font-bold uppercase tracking-widest">Inicie uma consulta</h3>
            <p className="text-slate-400 text-xs mt-2 max-w-xs leading-relaxed font-medium">Pergunte sobre provimentos, normas ou processos internos do cartório.</p>
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-900/20' 
                  : 'bg-[#0D1B3E] text-white border border-[#C9A84C]/30 rounded-bl-none shadow-xl'
              }`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#0D1B3E] border border-[#C9A84C]/30 rounded-2xl px-4 py-2 flex items-center gap-3">
                <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Analisando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-[#C9A84C]/30 bg-[#0D1B3E] flex gap-3">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)}
          placeholder="Digite sua dúvida jurídica..."
          className="flex-1 bg-[#0D1B3E] border border-[#C9A84C]/30 rounded-xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-200"
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isTyping}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-20 px-6 rounded-xl text-white transition-all flex items-center justify-center shadow-lg shadow-blue-900/20"
        >
          {isTyping ? '...' : '➤'}
        </button>
      </form>
    </div>
  );
};

export default ChatView;