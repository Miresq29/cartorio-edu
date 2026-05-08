
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { getGeminiResponse } from '../../services/geminiService';

const ExpertReviewView: React.FC = () => {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const handleDeepAudit = async () => {
    if (!query.trim()) return showToast('Descreva o caso para análise.', 'warning');
    
    setIsAnalyzing(true);
    setReport(null); // Limpa relatório anterior
    
    try {
      const expertPrompt = `PARECER TÉCNICO CORRECIONAL DE ALTA COMPLEXIDADE:
      Analise a seguinte situação notarial com o rigor de um Corregedor Sênior. 
      Identifique nulidades potenciais, riscos operacionais e cite a base legal pertinente (Leis federais e Provimentos do CNJ).
      
      SITUAÇÃO EXPOSTA:
      ${query}`;
      
      const result = await getGeminiResponse(expertPrompt);
      
      if (!result || result.includes("Sem resposta")) {
         throw new Error("A IA não retornou um parecer válido.");
      }

      setReport(result);
      showToast('Auditoria técnica sênior concluída.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Falha no processamento da auditoria.', 'error');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-12 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      
      {/* Como usar */}
      <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-8 flex items-start gap-5">
         <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 mt-1">
            <i className="fa-solid fa-brain text-2xl"></i>
         </div>
         <div>
           <h4 className="text-xl font-black text-blue-500 uppercase tracking-widest">IA Correcional</h4>
           <p className="text-lg text-slate-500 mt-3 leading-relaxed font-medium">
             Descreva situações complexas, incomuns ou suspeitas. A IA assumirá a persona de um Corregedor Sênior para emitir um parecer sobre viabilidade jurídica, nulidades e riscos.
           </p>
         </div>
      </div>

      <header className="flex items-center gap-8">
           <div className="w-24 h-24 bg-blue-600 rounded-[32px] flex items-center justify-center text-white shadow-2xl shadow-blue-600/20">
             <i className="fa-solid fa-brain text-5xl"></i>
           </div>
           <div>
             <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">IA <span className="text-blue-500">Analítica</span></h2>
             <p className="text-slate-400 font-black uppercase tracking-widest text-sm mt-3 flex items-center gap-3">
               <span className="w-4 h-4 rounded-full bg-blue-500"></span> Motor de Alta Complexidade Jurídica
             </p>
           </div>
      </header>

      <div className="bg-[#0a0f1d] rounded-[48px] border border-slate-800 shadow-4xl overflow-hidden relative group">
        <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <div className="p-12 space-y-10 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
            <h3 className="text-lg font-black text-slate-500 uppercase tracking-[0.4em]">Submissão de Caso Técnico</h3>
          </div>
          
          <textarea 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-80 bg-slate-950 border border-slate-800 rounded-[32px] p-10 focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 focus:outline-none transition-all text-slate-300 leading-loose font-serif text-xl placeholder:text-slate-200"
            placeholder="Ex: Análise de viabilidade jurídica de inventário extrajudicial com herdeiro incapaz assistido por curador especial sob a égide do novo provimento..."
          />
          
          <button 
            onClick={handleDeepAudit}
            disabled={isAnalyzing || !query.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-8 rounded-[32px] font-black text-base uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/20 transition-all flex items-center justify-center gap-4 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <><i className="fa-solid fa-circle-notch animate-spin text-2xl"></i> Processando Parecer Técnico...</>
            ) : (
              <><i className="fa-solid fa-gavel text-2xl"></i> Gerar Parecer Correcional</>
            )}
          </button>
        </div>
      </div>

      {report && (
        <div className="bg-[#0a0f1d] rounded-[48px] p-16 border border-slate-800 shadow-4xl animate-in slide-in-from-bottom-12 duration-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none">
             <i className="fa-solid fa-scale-balanced text-[180px] text-white"></i>
          </div>
          
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                <i className="fa-solid fa-file-signature text-2xl"></i>
              </div>
              <h4 className="text-white font-black uppercase tracking-[0.4em] text-sm italic">Relatório IA de Qualificação</h4>
            </div>
            <button 
              onClick={() => window.print()}
              className="text-blue-500 text-xs font-black uppercase tracking-widest hover:text-white transition-all flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-900"
            >
              <i className="fa-solid fa-print"></i> Exportar Parecer
            </button>
          </div>
          
          <div className="prose prose-invert max-w-none prose-xl font-serif leading-loose text-slate-300">
             {report.split('\n').map((line, i) => (
               <p key={i} className="mb-8">{line}</p>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpertReviewView;
