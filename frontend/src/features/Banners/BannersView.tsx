import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db, storage } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { GeminiService } from '../../services/geminiService';

interface Material {
  id: string;
  titulo: string;
  tipo: 'banner' | 'pdf' | 'imagem' | 'apresentacao';
  storageUrl: string;
  storagePath: string;
  tamanhoBytes: number;
  mimeType: string;
  textoBanner: string;
  tenantId: string;
  criadoEm: any;
}

const TIPO_CONFIG = {
  banner:       { label: 'Banner',        icon: 'fa-image',           color: 'pink'    },
  pdf:          { label: 'PDF',           icon: 'fa-file-pdf',        color: 'red'     },
  imagem:       { label: 'Imagem',        icon: 'fa-file-image',      color: 'blue'    },
  apresentacao: { label: 'Apresentação',  icon: 'fa-file-powerpoint', color: 'amber'   },
};

const BannersView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(state.user?.role || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [materiais, setMateriais] = useState<Material[]>([]);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [promptBanner, setPromptBanner] = useState('');
  const [textoBannerGerado, setTextoBannerGerado] = useState('');
  const [tituloBanner, setTituloBanner] = useState('');
  const [previewBanner, setPreviewBanner] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'materiaisbanner'), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, s => setMateriais(s.docs.map(d => ({ id: d.id, ...d.data() } as Material))));
  }, []);

  const uploadArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Arquivo muito grande. Máximo 10MB.', 'error'); return; }

    setUploading(true);
    try {
      const path = `materiais/${state.user?.tenantId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const tipo = file.type.includes('pdf') ? 'pdf'
        : file.type.includes('presentation') || file.name.endsWith('.pptx') ? 'apresentacao'
        : 'imagem';

      await addDoc(collection(db, 'materiaisbanner'), {
        titulo: file.name.replace(/\.[^.]+$/, ''),
        tipo, storageUrl: url, storagePath: path,
        tamanhoBytes: file.size, mimeType: file.type,
        textoBanner: '', tenantId: state.user?.tenantId || '',
        publicadoPor: state.user?.id || '', criadoEm: serverTimestamp(),
      });
      showToast('Arquivo enviado com sucesso!', 'success');
    } catch { showToast('Erro ao enviar arquivo.', 'error'); } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const gerarTextoBanner = async () => {
    if (!promptBanner.trim()) { showToast('Descreva o conteúdo do banner.', 'error'); return; }
    setGerando(true);
    try {
      const prompt = `Crie um texto profissional e impactante para um banner corporativo de treinamento com o seguinte tema: "${promptBanner}".

O texto deve ter:
- Um título principal curto e impactante (máx 8 palavras)
- Um subtítulo explicativo (1-2 frases)
- Um call-to-action motivador
- Tom profissional e positivo

Formato de resposta:
TÍTULO: [título aqui]
SUBTÍTULO: [subtítulo aqui]
CTA: [chamada para ação aqui]`;

      const resultado = await GeminiService.chat(prompt, '', state.token || '');
      const texto = typeof resultado === 'string' ? resultado : (resultado as any).text || '';
      setTextoBannerGerado(texto);
      setPreviewBanner(true);
    } catch { showToast('Erro ao gerar texto do banner.', 'error'); } finally { setGerando(false); }
  };

  const salvarBannerGerado = async () => {
    if (!tituloBanner.trim() || !textoBannerGerado.trim()) { showToast('Adicione um título para o banner.', 'error'); return; }
    await addDoc(collection(db, 'materiaisbanner'), {
      titulo: tituloBanner, tipo: 'banner', storageUrl: '', storagePath: '',
      tamanhoBytes: 0, mimeType: 'text/plain', textoBanner: textoBannerGerado,
      tenantId: state.user?.tenantId || '', publicadoPor: state.user?.id || '',
      criadoEm: serverTimestamp(),
    });
    showToast('Banner salvo!', 'success');
    setTituloBanner(''); setTextoBannerGerado(''); setPromptBanner(''); setPreviewBanner(false);
  };

  const imprimirBanner = () => {
    const conteudo = bannerRef.current?.innerHTML || '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Banner</title>
      <style>
        body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%); color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .banner { text-align: center; padding: 60px 80px; max-width: 800px; }
        .banner h1 { font-size: 48px; font-weight: 900; margin-bottom: 20px; text-transform: uppercase; letter-spacing: -1px; }
        .banner p { font-size: 20px; opacity: 0.85; margin-bottom: 30px; line-height: 1.6; }
        .banner .cta { background: #2563eb; padding: 16px 40px; border-radius: 12px; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; display: inline-block; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style></head><body><div class="banner">${conteudo}</div></body></html>`);
    win.document.close();
    win.print();
  };

  const excluir = async (m: Material) => {
    if (!confirm('Excluir este material?')) return;
    try {
      if (m.storagePath) await deleteObject(ref(storage, m.storagePath));
      await deleteDoc(doc(db, 'materiaisbanner', m.id));
      showToast('Material excluído.', 'success');
    } catch { showToast('Erro ao excluir.', 'error'); }
  };

  const formatSize = (bytes: number) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes > 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`;

  const filtrados = materiais.filter(m => !filtroTipo || m.tipo === filtroTipo);

  const parseBannerText = (texto: string) => {
    const titulo = texto.match(/TÍTULO:\s*(.+)/)?.[1] || '';
    const subtitulo = texto.match(/SUBTÍTULO:\s*(.+)/)?.[1] || '';
    const cta = texto.match(/CTA:\s*(.+)/)?.[1] || '';
    return { titulo, subtitulo, cta };
  };

  return (
    <div className="p-8 space-y-6 bg-[#05080f] min-h-screen animate-in fade-in">
      <header>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Banners e <span className="text-pink-500">Materiais</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Crie, gerencie e compartilhe materiais de treinamento</p>
      </header>

      {isGestor && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload */}
          <div className="bg-[#0a111f] border border-slate-800 rounded-[24px] p-6 space-y-4">
            <h3 className="text-white font-black uppercase text-sm flex items-center gap-2">
              <i className="fa-solid fa-upload text-blue-400"></i>Upload de Arquivo
            </h3>
            <p className="text-[10px] text-slate-500 leading-relaxed">Faça upload de imagens, PDFs ou apresentações. Máximo 10MB por arquivo.</p>
            <input ref={fileInputRef} type="file" onChange={uploadArquivo} accept="image/*,.pdf,.pptx,.ppt"
              className="hidden" id="fileUpload" />
            <label htmlFor="fileUpload"
              className={`w-full flex items-center justify-center gap-3 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl py-8 cursor-pointer transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading
                ? <><i className="fa-solid fa-circle-notch animate-spin text-blue-400 text-xl"></i><span className="text-slate-400 text-sm font-bold">Enviando...</span></>
                : <><i className="fa-solid fa-cloud-arrow-up text-slate-500 text-2xl"></i><span className="text-slate-400 text-sm font-bold">Clique para enviar arquivo</span></>
              }
            </label>
          </div>

          {/* Gerador IA */}
          <div className="bg-[#0a111f] border border-pink-500/30 rounded-[24px] p-6 space-y-4">
            <h3 className="text-white font-black uppercase text-sm flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles text-pink-400"></i>Gerar Banner com IA
            </h3>
            <textarea value={promptBanner} onChange={e => setPromptBanner(e.target.value)} rows={3}
              placeholder="Ex: Banner para treinamento de atendimento ao cliente com foco em excelência..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500 resize-none" />
            <button onClick={gerarTextoBanner} disabled={gerando || !promptBanner.trim()}
              className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              {gerando ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Gerando...</> : <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Gerar Texto</>}
            </button>
          </div>
        </div>
      )}

      {/* Preview Banner Gerado */}
      {previewBanner && textoBannerGerado && (
        <div className="bg-[#0a111f] border border-pink-500/30 rounded-[24px] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-black uppercase text-sm">Preview do Banner</h3>
            <div className="flex gap-2">
              <button onClick={imprimirBanner}
                className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all">
                <i className="fa-solid fa-print mr-1"></i>Imprimir / PDF
              </button>
            </div>
          </div>
          {/* Banner Preview */}
          <div ref={bannerRef} className="bg-gradient-to-br from-blue-900 to-slate-900 rounded-2xl p-10 text-center space-y-4 border border-blue-500/20">
            {(() => {
              const { titulo, subtitulo, cta } = parseBannerText(textoBannerGerado);
              return <>
                <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight">{titulo || 'Título do Banner'}</h1>
                <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-lg mx-auto">{subtitulo}</p>
                {cta && <div className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest">{cta}</div>}
              </>;
            })()}
          </div>
          <div className="flex gap-3">
            <input value={tituloBanner} onChange={e => setTituloBanner(e.target.value)}
              placeholder="Nome para salvar este banner..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500" />
            <button onClick={salvarBannerGerado} disabled={!tituloBanner.trim()}
              className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              <i className="fa-solid fa-floppy-disk mr-2"></i>Salvar
            </button>
            <button onClick={() => setPreviewBanner(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => setFiltroTipo('')}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!filtroTipo ? 'bg-pink-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
          Todos ({materiais.length})
        </button>
        {Object.entries(TIPO_CONFIG).map(([id, cfg]) => (
          <button key={id} onClick={() => setFiltroTipo(filtroTipo === id ? '' : id)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filtroTipo === id ? `bg-${cfg.color}-600 text-white` : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
            <i className={`fa-solid ${cfg.icon} mr-1.5`}></i>{cfg.label}
          </button>
        ))}
      </div>

      {/* Grid de materiais */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <i className="fa-solid fa-images text-5xl text-slate-600 mb-4"></i>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Nenhum material encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(m => {
            const cfg = TIPO_CONFIG[m.tipo] || TIPO_CONFIG.imagem;
            return (
              <div key={m.id} className="bg-[#0a111f] border border-slate-800 rounded-[20px] p-5 space-y-3 hover:border-slate-700 transition-all group">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-${cfg.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                    <i className={`fa-solid ${cfg.icon} text-${cfg.color}-400`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{m.titulo}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">{cfg.label} {m.tamanhoBytes > 0 && `· ${formatSize(m.tamanhoBytes)}`}</p>
                  </div>
                </div>
                {m.textoBanner && (
                  <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-3">{m.textoBanner.replace(/TÍTULO:|SUBTÍTULO:|CTA:/g, '').substring(0, 120)}...</p>
                )}
                {m.storageUrl && m.tipo === 'imagem' && (
                  <img src={m.storageUrl} alt={m.titulo} className="w-full h-28 object-cover rounded-xl" />
                )}
                <div className="flex gap-2">
                  {m.storageUrl && (
                    <a href={m.storageUrl} target="_blank" rel="noreferrer"
                      className="flex-1 text-center text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl font-black uppercase tracking-widest transition-all">
                      <i className="fa-solid fa-eye mr-1"></i>Abrir
                    </a>
                  )}
                  {isGestor && (
                    <button onClick={() => excluir(m)}
                      className="w-8 h-8 bg-slate-900 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-xl flex items-center justify-center transition-all">
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BannersView;
