import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAudit } from '../../hooks/useAudit';
import { extractTextFromFile } from '../../services/extractor';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, where
} from 'firebase/firestore';

interface KBDoc {
  id: string;
  tenantId: string;
  title: string;
  fileName: string;
  content: string;
  rawText: string;
  status: string;
  createdAt: any;
}

const KnowledgeBase: React.FC = () => {
  const { state } = useApp();
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<KBDoc | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [docs, setDocs] = useState<KBDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();
  const { logAction } = useAudit();

  const user = state.user;
  const canManage = user?.role === 'SUPERADMIN' || user?.role === 'gestor';

  useEffect(() => {
    if (!user) return;
    let q: any;
    if (user.role === 'SUPERADMIN') {
      q = query(collection(db, 'knowledgeBase'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'knowledgeBase'),
        where('tenantId', '==', user.tenantId),
        orderBy('createdAt', 'desc')
      );
    }
    const unsub = onSnapshot(q, snap => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as KBDoc)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const filteredDocs = useMemo(() => {
    if (!searchTerm.trim()) return docs;
    const term = searchTerm.toLowerCase();
    return docs.filter(d =>
      d.fileName?.toLowerCase().includes(term) ||
      d.content?.toLowerCase().includes(term)
    );
  }, [docs, searchTerm]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // ✅ CORREÇÃO: Validação de nome duplicado
    const isDuplicate = docs.some(
      d => d.fileName?.toLowerCase() === file.name.toLowerCase() && d.tenantId === user.tenantId
    );
    if (isDuplicate) {
      showToast(`Já existe um documento com o nome "${file.name}" na base legal. Renomeie o arquivo antes de enviar.`, 'error');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    showToast('Extraindo texto do documento com IA... Aguarde.', 'info');

    try {
      const extracted = await extractTextFromFile(file);
      const content = extracted.rawText || '';

      if (!content.trim()) {
        showToast('Não foi possível extrair texto do arquivo.', 'error');
        return;
      }

      await addDoc(collection(db, 'knowledgeBase'), {
        tenantId: user.tenantId,
        title: file.name,
        fileName: file.name,
        content,
        rawText: content,
        status: 'analyzed',
        createdAt: serverTimestamp(),
        createdBy: user.id
      });

      if (logAction) logAction('UPLOAD_KB', `Doc: ${file.name}`, 'SYSTEM');
      showToast('Documento indexado com sucesso!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro no processamento.', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    if (deleteConfirmId === docId) {
      try {
        await deleteDoc(doc(db, 'knowledgeBase', docId));
        if (viewingDoc?.id === docId) setViewingDoc(null);
        showToast('Removido com sucesso.', 'success');
      } catch { showToast('Erro ao remover.', 'error'); }
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(docId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const wordCount = (text: string) => text?.trim().split(/\s+/).length || 0;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-[#F8F7F2] min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-2">
        <div>
          <h2 className="text-4xl font-black text-[#0A1628] italic uppercase tracking-tighter">Base Legal</h2>
          <p className="text-slate-500 text-[10px] font-bold mt-2 uppercase tracking-[0.3em]">
            {user?.tenantId || 'MJ'} // {docs.length} documento{docs.length !== 1 ? 's' : ''} indexado{docs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar na base..."
              className="bg-slate-900 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs text-[#0A1628] outline-none focus:border-blue-500 w-56" />
          </div>
          {canManage && (
            <label className={`bg-blue-600 hover:bg-blue-500 text-[#0A1628] px-6 py-3 rounded-2xl cursor-pointer flex items-center gap-3 text-xs font-black uppercase transition-all shadow-lg shadow-blue-900/20 ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <i className={`fa-solid ${isUploading ? 'fa-circle-notch animate-spin' : 'fa-cloud-arrow-up'}`}></i>
              {isUploading ? 'Processando...' : 'Adicionar'}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.bmp,.gif" />
            </label>
          )}
        </div>
      </header>

      {loading && <div className="text-center py-20 text-slate-600 text-xs font-bold uppercase animate-pulse">Carregando base legal...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!loading && filteredDocs.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[40px]">
            <i className="fa-solid fa-book-open text-5xl text-slate-700 mb-4 block"></i>
            <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">
              {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum documento na base legal'}
            </p>
          </div>
        )}
        {filteredDocs.map((document) => (
          <div key={document.id} className="bg-[#F8F7F2] border border-slate-200 rounded-[32px] p-8 flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center">
                  <i className="fa-solid fa-file-lines text-xl text-blue-500"></i>
                </div>
                {canManage && (
                  <button onClick={() => handleDelete(document.id)} className="text-slate-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <i className={`fa-solid ${deleteConfirmId === document.id ? 'fa-check text-emerald-500' : 'fa-trash-can'} text-sm`}></i>
                  </button>
                )}
              </div>
              <h4 className="text-[#0A1628] font-bold italic leading-tight line-clamp-2">{document.fileName || document.title}</h4>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[9px] bg-emerald-500/10 text-emerald-500 font-black uppercase px-2 py-1 rounded">Indexado</span>
                <span className="text-[9px] text-slate-600 font-bold">{wordCount(document.content).toLocaleString()} palavras</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3 line-clamp-3 leading-relaxed">{document.content?.substring(0, 150)}...</p>
            </div>
            <button onClick={() => setViewingDoc(document)} className="mt-6 text-[10px] text-blue-400 font-black uppercase tracking-widest text-left hover:text-blue-300 flex items-center gap-2">
              Ver Conteúdo Integral <i className="fa-solid fa-arrow-right text-[8px]"></i>
            </button>
          </div>
        ))}
      </div>

      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#F8F7F2] border border-slate-200 w-full max-w-5xl max-h-[90vh] rounded-[40px] flex flex-col overflow-hidden shadow-2xl">
            <header className="p-8 border-b border-slate-200 flex justify-between items-center bg-slate-900/20 flex-shrink-0">
              <div>
                <h3 className="text-[#0A1628] font-black uppercase italic tracking-tight">{viewingDoc.fileName || viewingDoc.title}</h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">{wordCount(viewingDoc.content).toLocaleString()} palavras // Conteúdo integral</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => navigator.clipboard.writeText(viewingDoc.content).then(() => showToast('Copiado!', 'success'))}
                  className="text-xs text-slate-500 hover:text-[#0A1628] font-bold uppercase px-4 py-2 rounded-xl hover:bg-slate-800 transition-all">
                  <i className="fa-solid fa-copy mr-2"></i>Copiar
                </button>
                <button onClick={() => setViewingDoc(null)} className="w-10 h-10 rounded-full bg-slate-800 text-[#0A1628] flex items-center justify-center hover:bg-red-500 transition-all">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-10 bg-[#F8F7F2]">
              <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">{viewingDoc.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
