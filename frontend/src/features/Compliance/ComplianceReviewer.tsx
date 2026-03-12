import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAudit } from '../../hooks/useAudit';
import { useToast } from '../../context/ToastContext';
import { extractTextFromFile } from '../../services/extractor';
import { GeminiService } from '../../services/geminiService';
import { db } from '../../services/firebase';
import {
  collection, getDocs, onSnapshot, query, orderBy, where
} from 'firebase/firestore';

interface ComplianceResult {
  requirement: string;
  compliant: boolean;
  comment: string;
  suggestion: string;
}

interface KBDoc { id: string; fileName: string; content: string; rawText: string; tenantId: string; }
interface Checklist { id: string; title: string; items: { id: string; text: string }[]; tenantId: string; }

const ComplianceReviewer: React.FC = () => {
  const { state } = useApp();
  const { logAction } = useAudit();
  const { showToast } = useToast();

  // ✅ CORREÇÃO: docData agora usa rawText (texto real extraído)
  const [docData, setDocData] = useState<{ fileName: string; text: string } | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'checklist' | 'baselegal'>('checklist');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [kbDocs, setKbDocs] = useState<KBDoc[]>([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState('');
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [rawParecer, setRawParecer] = useState('');
  const [auditDate, setAuditDate] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tenantId = state.user?.tenantId || '';

  useEffect(() => {
    const q1 = query(collection(db, 'checklists'), orderBy('createdAt', 'desc'));
    const unsub1 = onSnapshot(q1, snap => setChecklists(snap.docs.map(d => ({ id: d.id, ...d.data() } as Checklist))));

    const fetchKB = async () => {
      try {
        const q2 = query(collection(db, 'knowledgeBase'), where('tenantId', '==', tenantId));
        const snap = await getDocs(q2);
        setKbDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as KBDoc)));
      } catch { /* sem base legal */ }
    };
    fetchKB();

    return () => { unsub1(); };
  }, [tenantId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Extraindo texto do documento com IA... Aguarde.', 'info');
      const extracted = await extractTextFromFile(file);

      // ✅ CORREÇÃO: usa rawText que agora contém texto real (inclusive de PDFs)
      const textoReal = extracted.rawText || extracted.content || '';

      if (!textoReal.trim()) {
        showToast('Não foi possível extrair texto do arquivo.', 'error');
        return;
      }

      setDocData({ fileName: file.name, text: textoReal });
      showToast(`Documento carregado: ${textoReal.split(' ').length} palavras extraídas.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao ler arquivo.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleKbDoc = (id: string) => {
    setSelectedKbIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleRunAudit = async () => {
    if (!docData) return showToast('Suba um documento para conferência.', 'warning');

    if (analysisMode === 'checklist' && !selectedChecklistId)
      return showToast('Selecione um protocolo de referência.', 'warning');

    if (analysisMode === 'baselegal' && selectedKbIds.length === 0)
      return showToast('Selecione ao menos um documento da base legal.', 'warning');

    setIsAnalyzing(true);
    setResults([]);
    setRawParecer('');

    try {
      let contextBlock = '';
      let requirementsBlock = '';

      if (analysisMode === 'checklist') {
        const checklist = checklists.find(c => c.id === selectedChecklistId);
        if (!checklist) { showToast('Protocolo não encontrado.', 'error'); return; }

        requirementsBlock = checklist.items.map((item, i) => `${i + 1}. ${item.text}`).join('\n');

        if (kbDocs.length > 0) {
          contextBlock = kbDocs.map((d, i) =>
            `[DOCUMENTO BASE LEGAL ${i + 1} — ${d.fileName}]\n${(d.rawText || d.content)?.substring(0, 2000)}`
          ).join('\n\n---\n\n');
        }
      } else {
        const selected = kbDocs.filter(d => selectedKbIds.includes(d.id));
        contextBlock = selected.map((d, i) =>
          `[DOCUMENTO ${i + 1} — ${d.fileName}]\n${(d.rawText || d.content)?.substring(0, 3000)}`
        ).join('\n\n---\n\n');
        requirementsBlock = 'Extraia os requisitos normativos dos documentos da base legal acima e aplique-os na análise do documento auditado.';
      }

      const prompt = `Você é um auditor notarial sênior. Sua análise DEVE ser baseada EXCLUSIVAMENTE nos documentos e requisitos fornecidos abaixo. É PROIBIDO utilizar qualquer lei, norma, provimento ou conhecimento externo que não esteja presente no contexto fornecido. Se não houver base suficiente no contexto, declare explicitamente que a informação não está disponível.

════════════════════════════════════════════════════
MODO DE ANÁLISE: ${analysisMode === 'checklist' ? 'PROTOCOLO DE CONFORMIDADE' : 'BASE LEGAL NORMATIVA'}
════════════════════════════════════════════════════

${analysisMode === 'checklist' ? `PROTOCOLO DE VERIFICAÇÃO:\n${requirementsBlock}` : `FONTE NORMATIVA (base legal indexada):\n${contextBlock}`}

${contextBlock && analysisMode === 'checklist' ? `BASE LEGAL DE APOIO (use apenas estas normas):\n${contextBlock}` : ''}

${analysisMode === 'baselegal' ? `REQUISITOS A APLICAR:\n${requirementsBlock}` : ''}

════════════════════════════════════════════════════
DOCUMENTO AUDITADO: "${docData.fileName}"
════════════════════════════════════════════════════
${docData.text.substring(0, 6000)}

════════════════════════════════════════════════════
INSTRUÇÕES OBRIGATÓRIAS DE ANÁLISE
════════════════════════════════════════════════════
1. Analise cada requisito/item individualmente
2. Para cada item, cite o trecho exato do documento auditado ou da base legal que embasa sua conclusão
3. Se a base legal não cobrir um ponto, declare: "Sem base normativa disponível para este requisito"
4. Seja minucioso, técnico e formal
5. Retorne sua análise em JSON estrito no formato:
[{"requirement": "descrição do requisito", "compliant": true/false, "comment": "análise técnica com citação", "suggestion": "sugestão de correção se não conforme"}]
6. Após o JSON, adicione um RESUMO EXECUTIVO com percentual de conformidade e conclusão geral`;

      const response = await GeminiService.chat(prompt, 'Auditoria de conformidade RAG notarial');
      const rawText = typeof response === 'string' ? response : (response as any).text;

      if (rawText) {
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            setResults(parsed);
            const afterJson = rawText.substring(rawText.lastIndexOf(']') + 1).trim();
            if (afterJson) setRawParecer(afterJson);
          } catch {
            setRawParecer(rawText);
            showToast('Parecer gerado em texto livre.', 'info');
          }
        } else {
          setRawParecer(rawText);
          showToast('Parecer gerado em texto livre.', 'info');
        }

        setAuditDate(new Date().toLocaleString('pt-BR'));
        if (logAction) logAction('COMPLIANCE_RAG', `Auditoria: ${docData.fileName}`, 'SYSTEM');
        showToast('Auditoria RAG finalizada!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Falha na auditoria IA.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const conformeCount = results.filter(r => r.compliant).length;
  const conformePercent = results.length > 0 ? Math.round((conformeCount / results.length) * 100) : 0;

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 pb-32 animate-in fade-in duration-700">

      <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-6 flex items-start gap-5 no-print">
        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 mt-1">
          <i className="fa-solid fa-file-contract text-2xl"></i>
        </div>
        <div>
          <h4 className="text-xl font-black text-blue-500 uppercase tracking-widest">Auditoria de Conformidade — Metodologia RAG</h4>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed font-medium italic">
            A análise é feita exclusivamente com base nos documentos da sua Base Legal indexada e nos Protocolos cadastrados. Nenhuma informação externa é utilizada.
          </p>
        </div>
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
            <i className="fa-solid fa-shield-check text-3xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-100 tracking-tight italic uppercase">Conformidade</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Tenant: {state.user?.tenantId}</p>
          </div>
        </div>
        {(results.length > 0 || rawParecer) && (
          <button onClick={() => window.print()} className="bg-white text-black px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-200 transition-all">
            <i className="fa-solid fa-print mr-2"></i>Imprimir Relatório
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-[32px] p-8 space-y-7 shadow-2xl">

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Documento a Auditar</label>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,.bmp,.gif" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full py-10 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-3 transition-all ${docData ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 hover:border-blue-500/50'}`}
              >
                <i className={`fa-solid ${docData ? 'fa-file-circle-check text-emerald-500' : 'fa-cloud-arrow-up text-slate-600'} text-4xl`}></i>
                <p className="text-xs font-bold text-slate-300 truncate max-w-xs px-4">{docData ? docData.fileName : 'Subir Minuta ou Documento'}</p>
                {docData && (
                  <p className="text-[9px] text-emerald-400 font-bold">{docData.text.split(' ').length} palavras extraídas</p>
                )}
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Analisar com base em</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAnalysisMode('checklist')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${analysisMode === 'checklist' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <i className="fa-solid fa-clipboard-list mr-2"></i>Protocolo
                </button>
                <button
                  onClick={() => setAnalysisMode('baselegal')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${analysisMode === 'baselegal' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <i className="fa-solid fa-book-open mr-2"></i>Base Legal
                </button>
              </div>
            </div>

            {analysisMode === 'checklist' && (
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Protocolo de Referência</label>
                {checklists.length === 0 ? (
                  <p className="text-xs text-slate-600 italic p-4 border border-slate-800 rounded-xl">Nenhum protocolo cadastrado. Crie um no módulo Checklists.</p>
                ) : (
                  <select
                    value={selectedChecklistId}
                    onChange={e => setSelectedChecklistId(e.target.value)}
                    className="w-full bg-[#05080f] border border-slate-800 rounded-xl px-4 py-4 text-xs font-bold text-slate-200 focus:border-blue-600 outline-none transition-all"
                  >
                    <option value="">Selecione um protocolo...</option>
                    {checklists.map(t => (
                      <option key={t.id} value={t.id}>{t.title.toUpperCase()} ({t.items?.length || 0} itens)</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {analysisMode === 'baselegal' && (
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Documentos da Base Legal ({selectedKbIds.length} selecionado{selectedKbIds.length !== 1 ? 's' : ''})
                </label>
                {kbDocs.length === 0 ? (
                  <p className="text-xs text-slate-600 italic p-4 border border-slate-800 rounded-xl">Nenhum documento indexado. Adicione documentos na Base Legal.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {kbDocs.map(d => (
                      <button
                        key={d.id}
                        onClick={() => toggleKbDoc(d.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${selectedKbIds.includes(d.id) ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-800 hover:border-slate-700'}`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${selectedKbIds.includes(d.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                          {selectedKbIds.includes(d.id) && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                        </div>
                        <span className="text-[10px] text-slate-300 font-bold truncate">{d.fileName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleRunAudit}
              disabled={isAnalyzing}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
            >
              {isAnalyzing
                ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Auditoria em curso...</>
                : <><i className="fa-solid fa-shield-check mr-2"></i>Iniciar Auditoria RAG</>}
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col justify-center items-center text-center p-10 bg-blue-600/5 border border-blue-500/10 rounded-[32px] shadow-inner">
          <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center text-blue-500 text-4xl mb-6 shadow-2xl">
            <i className="fa-solid fa-robot"></i>
          </div>
          <h3 className="text-xl font-black text-white uppercase italic">Análise RAG Estrita</h3>
          <p className="text-slate-400 text-sm mt-4 max-w-md leading-relaxed">
            O sistema usa apenas os documentos que você indexou na Base Legal e os protocolos cadastrados. Nenhuma lei ou norma externa é consultada.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 w-full max-w-sm">
            <div className="bg-slate-900 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-blue-500">{checklists.length}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">Protocolos</p>
            </div>
            <div className="bg-slate-900 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-blue-500">{kbDocs.length}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">Docs Indexados</p>
            </div>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="results-report mt-8 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0a111f] border border-slate-800 rounded-2xl p-6 text-center">
              <p className="text-3xl font-black text-white">{results.length}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">Total de Requisitos</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
              <p className="text-3xl font-black text-emerald-500">{conformeCount}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">Conformes</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-center">
              <p className="text-3xl font-black text-red-500">{results.length - conformeCount}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">Pendentes</p>
            </div>
          </div>

          <div className="bg-[#0a111f] border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Índice de Conformidade</span>
              <span className="text-sm font-black text-white">{conformePercent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-700 ${conformePercent >= 80 ? 'bg-emerald-500' : conformePercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${conformePercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-slate-600">Auditado em: {auditDate}</span>
              <span className="text-[9px] text-slate-600">{docData?.fileName}</span>
            </div>
          </div>

          <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl backdrop-blur-md">
            <h3 className="text-xl font-black text-white italic uppercase mb-6 flex items-center gap-3">
              <i className="fa-solid fa-file-invoice text-blue-500"></i> Parecer Técnico Detalhado
            </h3>
            <div className="space-y-4">
              {results.map((res, i) => (
                <div key={i} className={`p-6 rounded-2xl border ${res.compliant ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'} transition-all`}>
                  <div className="flex justify-between items-start mb-3 gap-4">
                    <h4 className="text-sm font-bold text-slate-200 flex-1">{res.requirement}</h4>
                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg flex-shrink-0 ${res.compliant ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                      {res.compliant ? '✅ CONFORME' : '❌ PENDENTE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{res.comment}</p>
                  {!res.compliant && res.suggestion && (
                    <div className="bg-slate-950 p-4 rounded-xl border border-red-500/10">
                      <p className="text-[10px] font-black text-red-400 uppercase mb-2">Sugestão de Retificação:</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{res.suggestion}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {rawParecer && (
            <div className="p-8 bg-[#0a111f] border border-slate-700 rounded-3xl">
              <h4 className="text-sm font-black text-blue-500 uppercase tracking-widest mb-4">
                <i className="fa-solid fa-memo-circle-check mr-2"></i>Resumo Executivo
              </h4>
              <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{rawParecer}</pre>
            </div>
          )}
        </div>
      )}

      {!results.length && rawParecer && (
        <div className="mt-8 p-8 bg-slate-900/40 border border-slate-800 rounded-3xl">
          <h3 className="text-lg font-black text-white italic uppercase mb-4 flex items-center gap-3">
            <i className="fa-solid fa-file-invoice text-blue-500"></i> Parecer Técnico
          </h3>
          <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{rawParecer}</pre>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>
    </div>
  );
};

export default ComplianceReviewer;
