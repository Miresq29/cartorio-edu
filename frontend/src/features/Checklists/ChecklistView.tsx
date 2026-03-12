import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useAudit } from '../../hooks/useAudit';
import { extractTextFromFile } from '../../services/extractor';
import { GeminiService } from '../../services/geminiService';
import { db } from '../../services/firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, getDocs, where
} from 'firebase/firestore';

interface ChecklistItem { id: string; text: string; }
interface Checklist { id: string; title: string; items: ChecklistItem[]; tenantId: string; createdAt: any; }

const ChecklistView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const { logAction } = useAudit();

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [mode, setMode] = useState<'roteiro' | 'executar'>('roteiro');

  // Execução
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [executionNotes, setExecutionNotes] = useState<Record<string, string>>({});

  // Análise RAG
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [uploadedDocText, setUploadedDocText] = useState('');
  const [uploadedDocName, setUploadedDocName] = useState('');
  const docFileRef = useRef<HTMLInputElement>(null);

  // Criação
  const [formName, setFormName] = useState('');
  const [formItems, setFormItems] = useState<string[]>(['']);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'checklists'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setChecklists(snap.docs.map(d => ({ id: d.id, ...d.data() } as Checklist)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const activeChecklist = checklists.find(t => t.id === activeChecklistId);

  const handleSelectChecklist = (id: string) => {
    setActiveChecklistId(id);
    setCheckedItems({});
    setExecutionNotes({});
    setMode('roteiro');
    setAnalysisResult('');
    setUploadedDocText('');
    setUploadedDocName('');
  };

  const openCreateModal = () => { setFormName(''); setFormItems(['']); setIsModalOpen(true); };

  const handleFileUploadModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingFile(true);
    showToast('IA extraindo requisitos...', 'info');
    try {
      const extracted = await extractTextFromFile(file);
      const response = await GeminiService.chat(
        `Você é especialista em direito notarial. Extraia uma lista numerada de requisitos obrigatórios e etapas de verificação deste documento para uso em checklist de conformidade notarial. Liste apenas os itens, um por linha, sem texto adicional:\n\n${extracted.rawText?.substring(0, 4000)}`,
        'Extração de checklist notarial'
      );
      const text = typeof response === 'string' ? response : (response as any).text;
      if (text) {
        const lines = text.split('\n').map((l: string) => l.replace(/^[\d\-•*\.]+\s*/, '').trim()).filter((l: string) => l.length > 5);
        setFormItems(prev => [...prev.filter(i => i.trim()), ...lines]);
        if (!formName) setFormName(file.name.split('.')[0].toUpperCase());
        showToast(`${lines.length} itens extraídos!`, 'success');
      }
    } catch { showToast('Erro ao processar arquivo.', 'error'); }
    finally { setIsProcessingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSave = async () => {
    const validItems = formItems.filter(i => i.trim().length > 0);
    if (!formName.trim()) return showToast('Nome do protocolo obrigatório', 'warning');
    if (validItems.length === 0) return showToast('Adicione ao menos um item', 'warning');
    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'checklists'), {
        title: formName.trim(),
        items: validItems.map(text => ({ id: Math.random().toString(36).substring(7), text: text.trim() })),
        tenantId: state.user?.tenantId || '',
        createdAt: serverTimestamp(),
        createdBy: state.user?.id
      });
      setActiveChecklistId(docRef.id);
      setIsModalOpen(false);
      if (logAction) logAction('CREATE_CHECKLIST', `Criado: ${formName}`, 'SYSTEM');
      showToast('Protocolo salvo!', 'success');
    } catch { showToast('Erro ao salvar protocolo.', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (checklistId: string, title: string) => {
    if (deleteConfirmId === checklistId) {
      try {
        await deleteDoc(doc(db, 'checklists', checklistId));
        if (activeChecklistId === checklistId) setActiveChecklistId(null);
        if (logAction) logAction('DELETE_CHECKLIST', `Excluído: ${title}`, 'SYSTEM');
        showToast('Protocolo excluído.', 'success');
      } catch { showToast('Erro ao excluir.', 'error'); }
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(checklistId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Carregando documento...', 'info');
      const extracted = await extractTextFromFile(file);
      setUploadedDocText(extracted.rawText || '');
      setUploadedDocName(file.name);
      showToast('Documento pronto para análise!', 'success');
    } catch { showToast('Erro ao carregar documento.', 'error'); }
    finally { if (docFileRef.current) docFileRef.current.value = ''; }
  };

  // ===== ANÁLISE RAG REAL =====
  const handleAnalyzeDoc = async () => {
    if (!activeChecklist) return;
    if (!uploadedDocText) return showToast('Suba um documento para analisar.', 'warning');

    setIsAnalyzing(true);
    setAnalysisResult('');

    try {
      // 1. Buscar base legal do Firestore (RAG)
      const tenantId = state.user?.tenantId || '';
      let kbContext = '';
      try {
        const kbQuery = query(
          collection(db, 'knowledgeBase'),
          where('tenantId', '==', tenantId)
        );
        const kbSnap = await getDocs(kbQuery);
        const kbDocs = kbSnap.docs.map(d => d.data());
        if (kbDocs.length > 0) {
          kbContext = kbDocs.map((d: any, i: number) =>
            `[BASE LEGAL ${i + 1} — ${d.fileName}]\n${d.content?.substring(0, 3000)}`
          ).join('\n\n---\n\n');
        }
      } catch { /* sem base legal, continua só com checklist */ }

      // 2. Montar checklist como contexto
      const checklistContext = activeChecklist.items.map((item, i) =>
        `${i + 1}. ${item.text}`
      ).join('\n');

      // 3. Prompt RAG estrito — proibido usar conhecimento externo
      const prompt = `Você é um auditor notarial especialista. Sua análise DEVE ser baseada EXCLUSIVAMENTE nos documentos fornecidos abaixo. NÃO utilize conhecimento externo, leis ou normas que não estejam presentes no contexto fornecido. Se uma informação não constar no contexto, diga explicitamente que não há base legal disponível para aquele ponto.

══════════════════════════════════
CHECKLIST DE VERIFICAÇÃO — "${activeChecklist.title}"
══════════════════════════════════
${checklistContext}

${kbContext ? `══════════════════════════════════
BASE LEGAL INDEXADA (use exclusivamente estes documentos)
══════════════════════════════════
${kbContext}` : '⚠️ ATENÇÃO: Nenhuma base legal foi indexada. A análise será feita somente com base no checklist acima.'}

══════════════════════════════════
DOCUMENTO A SER ANALISADO
══════════════════════════════════
${uploadedDocText.substring(0, 5000)}

══════════════════════════════════
INSTRUÇÕES DE ANÁLISE
══════════════════════════════════
Para cada item do checklist acima:
1. Verifique se o documento atende ao requisito
2. Indique ✅ CONFORME ou ❌ PENDENTE/IRREGULAR
3. Cite trecho do documento ou da base legal que embasa sua conclusão
4. Se não houver base para concluir, diga: "Sem base legal disponível para este item"

Produza um parecer técnico detalhado, minucioso e formal. Ao final, apresente um resumo executivo com o percentual de conformidade.`;

      const response = await GeminiService.chat(prompt, 'Auditoria RAG notarial');
      const text = typeof response === 'string' ? response : (response as any).text;
      setAnalysisResult(text || 'Sem resposta da IA.');
      if (logAction) logAction('CHECKLIST_AUDIT_RAG', `Auditoria RAG: ${activeChecklist.title} / Doc: ${uploadedDocName}`, 'SYSTEM');
      showToast('Análise RAG concluída!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro na análise.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalItems = activeChecklist?.items?.length || 0;
  const progress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  return (
    <div className="h-full flex bg-[#05080f] min-h-screen">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-800 flex flex-col bg-[#0a0f1d] flex-shrink-0">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Protocolos</h2>
          <button onClick={openCreateModal} className="text-blue-500 hover:text-blue-400 transition-colors">
            <i className="fa-solid fa-circle-plus text-2xl"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-xs text-slate-600 text-center py-4 animate-pulse">Carregando...</p>}
          {checklists.map(t => (
            <div key={t.id} className="group flex items-center gap-2">
              <button
                onClick={() => handleSelectChecklist(t.id)}
                className={`flex-1 p-4 rounded-xl flex items-center gap-3 transition-all text-left ${activeChecklistId === t.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
              >
                <i className="fa-solid fa-file-lines flex-shrink-0 text-sm"></i>
                <div className="min-w-0">
                  <span className="text-xs font-bold truncate uppercase block">{t.title}</span>
                  <span className="text-[9px] opacity-60">{t.items?.length || 0} itens</span>
                </div>
              </button>
              <button
                onClick={() => handleDelete(t.id, t.title)}
                className={`p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${deleteConfirmId === t.id ? 'text-red-500' : 'text-slate-600 hover:text-red-500'}`}
              >
                <i className={`fa-solid ${deleteConfirmId === t.id ? 'fa-check' : 'fa-trash-can'} text-xs`}></i>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {!activeChecklist ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-30 space-y-4 text-center p-10">
            <i className="fa-solid fa-clipboard-check text-8xl"></i>
            <p className="text-sm font-bold uppercase tracking-widest">Selecione ou Crie um Protocolo</p>
          </div>
        ) : (
          <div className="p-10 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-3xl font-black text-white italic uppercase">{activeChecklist.title}</h3>
                <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mt-2">
                  {totalItems} itens // Unidade: {state.user?.tenantId}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode('roteiro')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'roteiro' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  <i className="fa-solid fa-list mr-2"></i>Roteiro
                </button>
                <button onClick={() => setMode('executar')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'executar' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  <i className="fa-solid fa-check-double mr-2"></i>Executar
                </button>
              </div>
            </div>

            {/* MODO ROTEIRO */}
            {mode === 'roteiro' && (
              <div className="bg-[#0a111f] border border-slate-800 rounded-[32px] p-8 space-y-3 shadow-2xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Itens do Protocolo</p>
                {activeChecklist.items?.map((item, idx) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center text-blue-500 text-xs font-bold flex-shrink-0 mt-0.5">{idx + 1}</div>
                    <span className="text-sm text-slate-300 font-medium leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* MODO EXECUTAR */}
            {mode === 'executar' && (
              <div className="space-y-5">
                {/* Progresso */}
                <div className="bg-[#0a111f] border border-slate-800 rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progresso da Execução</span>
                    <span className="text-xs font-black text-white">{checkedCount}/{totalItems} — {progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                  </div>
                  {progress === 100 && (
                    <p className="text-[10px] text-emerald-500 font-black uppercase mt-2 text-center">✅ Protocolo concluído!</p>
                  )}
                </div>

                {/* Itens marcáveis */}
                <div className="space-y-3">
                  {activeChecklist.items?.map((item, idx) => (
                    <div key={item.id} className={`border rounded-2xl p-5 transition-all ${checkedItems[item.id] ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#0a111f] border-slate-800'}`}>
                      <div className="flex items-start gap-4">
                        <button
                          onClick={() => setCheckedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-all border-2 ${checkedItems[item.id] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 hover:border-blue-500'}`}
                        >
                          {checkedItems[item.id] && <i className="fa-solid fa-check text-xs"></i>}
                        </button>
                        <div className="flex-1">
                          <span className={`text-sm font-medium leading-relaxed ${checkedItems[item.id] ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                            <span className="text-[10px] font-black text-slate-600 mr-2">{idx + 1}.</span>{item.text}
                          </span>
                          <textarea
                            value={executionNotes[item.id] || ''}
                            onChange={e => setExecutionNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Observação (opcional)..."
                            rows={1}
                            className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-400 outline-none focus:border-blue-500 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Painel de Análise RAG */}
                <div className="bg-[#0a111f] border border-blue-500/20 rounded-[32px] p-8 space-y-5">
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                      <i className="fa-solid fa-robot mr-2"></i>Análise RAG — Verificar Documento
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      A IA analisará o documento contra este protocolo e a base legal indexada. Nenhuma informação externa será utilizada.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <input type="file" ref={docFileRef} onChange={handleDocUpload} className="hidden" accept=".pdf,.doc,.docx,.txt" />
                    <button
                      onClick={() => docFileRef.current?.click()}
                      className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${uploadedDocText ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' : 'border-slate-700 text-slate-400 hover:border-blue-500 hover:text-white'}`}
                    >
                      <i className={`fa-solid ${uploadedDocText ? 'fa-file-circle-check' : 'fa-cloud-arrow-up'}`}></i>
                      {uploadedDocText ? uploadedDocName : 'Subir Documento'}
                    </button>
                    <button
                      onClick={handleAnalyzeDoc}
                      disabled={isAnalyzing || !uploadedDocText}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-40"
                    >
                      {isAnalyzing ? <><i className="fa-solid fa-circle-notch animate-spin"></i> Analisando...</> : <><i className="fa-solid fa-shield-check"></i> Analisar com RAG</>}
                    </button>
                  </div>

                  {analysisResult && (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                          <i className="fa-solid fa-file-invoice mr-2"></i>Parecer Técnico — Baseado na Base Legal Indexada
                        </p>
                        <button
                          onClick={() => navigator.clipboard.writeText(analysisResult).then(() => showToast('Copiado!', 'success'))}
                          className="text-[9px] text-slate-500 hover:text-white font-bold uppercase px-3 py-1 rounded-lg hover:bg-slate-800 transition-all"
                        >
                          <i className="fa-solid fa-copy mr-1"></i>Copiar
                        </button>
                      </div>
                      <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{analysisResult}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de criação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl">
            <header className="p-8 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-white font-black uppercase italic">Novo Protocolo</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </header>
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome do Ato</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Escritura de Compra e Venda"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-blue-500" />
              </div>

              <div className="flex justify-between items-center p-4 bg-blue-600/5 rounded-2xl border border-blue-600/10">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-blue-500 uppercase block">Extrair via IA</span>
                  <p className="text-[9px] text-slate-500 uppercase">Gera itens a partir de um PDF/DOCX</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUploadModal} className="hidden" accept=".pdf,.doc,.docx" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessingFile}
                  className="bg-blue-600 text-white text-[10px] font-black uppercase px-6 py-3 rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50">
                  {isProcessingFile ? 'Extraindo...' : 'Subir Documento'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Itens</label>
                  <button onClick={() => setFormItems(prev => [...prev, ''])} className="text-[9px] text-blue-500 font-black uppercase hover:text-blue-400">+ Adicionar</button>
                </div>
                {formItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input value={item} onChange={e => { const u = [...formItems]; u[idx] = e.target.value; setFormItems(u); }}
                      placeholder={`Item ${idx + 1}`}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500" />
                    <button onClick={() => setFormItems(prev => prev.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-red-500 transition-colors px-2">
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <footer className="p-8 border-t border-slate-800 flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white text-[10px] font-black uppercase px-6 py-3 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white text-[10px] font-black uppercase px-8 py-3 rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50">
                {isSaving ? 'Salvando...' : 'Salvar Protocolo'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistView;
