import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, orderBy,
  addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { GeminiService } from '../../services/geminiService';

interface Material {
  id: string;
  titulo: string;
  tipo: 'banner' | 'pdf' | 'imagem' | 'apresentacao' | 'link';
  linkUrl: string;
  textoBanner: string;
  tenantId: string;
  criadoEm: any;
}

const TIPO_CONFIG = {
  banner:       { label: 'Banner IA',    icon: 'fa-wand-magic-sparkles', color: 'pink'    },
  imagem:       { label: 'Imagem',       icon: 'fa-file-image',          color: 'blue'    },
  pdf:          { label: 'PDF',          icon: 'fa-file-pdf',            color: 'red'     },
  apresentacao: { label: 'Apresentação', icon: 'fa-file-powerpoint',     color: 'amber'   },
  link:         { label: 'Link',         icon: 'fa-link',                color: 'emerald' },
};

const BannersView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(state.user?.role || '');

  const [materiais, setMateriais] = useState<Material[]>([]);
  const [filtroTipo, setFiltroTipo] = useState('');

  /* ── formulário link ──────────────────────────────── */
  const [formLink, setFormLink] = useState({ titulo: '', url: '', tipo: 'imagem' as Material['tipo'] });
  const [salvandoLink, setSalvandoLink] = useState(false);

  /* ── gerador IA ───────────────────────────────────── */
  const [promptBanner, setPromptBanner] = useState('');
  const [gerando, setGerando] = useState(false);
  const [textoBannerGerado, setTextoBannerGerado] = useState('');
  const [tituloBanner, setTituloBanner] = useState('');
  const [previewBanner, setPreviewBanner] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'materiaisbanner'), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, s =>
      setMateriais(s.docs.map(d => ({ id: d.id, ...d.data() } as Material)))
    );
  }, []);

  /* ── salva link externo ──────────────────────────── */
  const salvarLink = async () => {
    if (!formLink.titulo.trim() || !formLink.url.trim()) {
      showToast('Preencha o título e o link.', 'error');
      return;
    }
    setSalvandoLink(true);
    try {
      await addDoc(collection(db, 'materiaisbanner'), {
        titulo: formLink.titulo.trim(),
        tipo: formLink.tipo,
        linkUrl: formLink.url.trim(),
        textoBanner: '',
        tenantId: state.user?.tenantId || '',
        publicadoPor: state.user?.id || '',
        criadoEm: serverTimestamp(),
      });
      showToast('Material adicionado!', 'success');
      setFormLink({ titulo: '', url: '', tipo: 'imagem' });
    } catch {
      showToast('Erro ao salvar. Tente novamente.', 'error');
    } finally {
      setSalvandoLink(false);
    }
  };

  /* ── gera texto de banner por IA ──────────────────── */
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

      const resultado = await GeminiService.chat(prompt, '', '');
      const texto = typeof resultado === 'string' ? resultado : (resultado as any).text || '';
      setTextoBannerGerado(texto);
      setPreviewBanner(true);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao gerar texto do banner.', 'error');
    } finally {
      setGerando(false);
    }
  };

  /* ── salva banner gerado por IA ───────────────────── */
  const salvarBannerGerado = async () => {
    if (!tituloBanner.trim() || !textoBannerGerado.trim()) {
      showToast('Adicione um título para o banner.', 'error');
      return;
    }
    await addDoc(collection(db, 'materiaisbanner'), {
      titulo: tituloBanner,
      tipo: 'banner',
      linkUrl: '',
      textoBanner: textoBannerGerado,
      tenantId: state.user?.tenantId || '',
      publicadoPor: state.user?.id || '',
      criadoEm: serverTimestamp(),
    });
    showToast('Banner salvo!', 'success');
    setTituloBanner(''); setTextoBannerGerado(''); setPromptBanner(''); setPreviewBanner(false);
  };

  /* ── imprime banner ───────────────────────────────── */
  const imprimirBanner = (texto: string) => {
    const { titulo, subtitulo, cta } = parseBannerText(texto);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Banner</title>
      <style>
        body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(135deg,#1e3a5f 0%,#0a1628 100%); color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .banner { text-align: center; padding: 60px 80px; max-width: 800px; }
        .banner h1 { font-size: 48px; font-weight: 900; margin-bottom: 20px; text-transform: uppercase; letter-spacing: -1px; }
        .banner p { font-size: 20px; opacity: 0.85; margin-bottom: 30px; line-height: 1.6; }
        .banner .cta { background: #2563eb; padding: 16px 40px; border-radius: 12px; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; display: inline-block; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style></head><body>
      <div class="banner">
        <h1>${titulo}</h1>
        <p>${subtitulo}</p>
        ${cta ? `<div class="cta">${cta}</div>` : ''}
      </div></body></html>`);
    win.document.close();
    win.print();
  };

  /* ── excluir ──────────────────────────────────────── */
  const excluir = async (id: string) => {
    if (!confirm('Excluir este material?')) return;
    try {
      await deleteDoc(doc(db, 'materiaisbanner', id));
      showToast('Material excluído.', 'success');
    } catch {
      showToast('Erro ao excluir.', 'error');
    }
  };

  const parseBannerText = (texto: string) => ({
    titulo:    texto.match(/TÍTULO:\s*(.+)/)?.[1]?.trim()    || '',
    subtitulo: texto.match(/SUBTÍTULO:\s*(.+)/)?.[1]?.trim() || '',
    cta:       texto.match(/CTA:\s*(.+)/)?.[1]?.trim()       || '',
  });

  const filtrados = materiais.filter(m => !filtroTipo || m.tipo === filtroTipo);

  /* ══════════════════ RENDER ══════════════════════════ */
  return (
    <div className="p-8 space-y-6 bg-[#0D1B3E] min-h-screen animate-in fade-in">
      <header>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Banners e <span className="text-pink-500">Materiais</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
          Crie, gerencie e compartilhe materiais de treinamento
        </p>
      </header>

      {isGestor && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Link externo ────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4">
            <h3 className="text-[#0A1628] font-black uppercase text-sm flex items-center gap-2">
              <i className="fa-solid fa-link text-blue-400"></i>Adicionar Material via Link
            </h3>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Cole um link do Google Drive, OneDrive, Dropbox ou qualquer URL pública.
            </p>

            <input
              value={formLink.titulo}
              onChange={e => setFormLink(p => ({ ...p, titulo: e.target.value }))}
              placeholder="Nome do material..."
              className="w-full bg-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500 transition-colors"
            />

            <input
              value={formLink.url}
              onChange={e => setFormLink(p => ({ ...p, url: e.target.value }))}
              placeholder="https://drive.google.com/..."
              className="w-full bg-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500 transition-colors"
            />

            {/* Tipo */}
            <div className="flex flex-wrap gap-2">
              {(['imagem', 'pdf', 'apresentacao', 'link'] as const).map(t => (
                <button type="button" key={t} onClick={() => setFormLink(p => ({ ...p, tipo: t }))}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    formLink.tipo === t
                      ? 'bg-blue-600 text-[#0A1628]'
                      : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                  }`}>
                  <i className={`fa-solid ${TIPO_CONFIG[t].icon} mr-1`}></i>{TIPO_CONFIG[t].label}
                </button>
              ))}
            </div>

            <button type="button" onClick={salvarLink} disabled={salvandoLink || !formLink.titulo.trim() || !formLink.url.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-[#0A1628] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              {salvandoLink
                ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Salvando...</>
                : <><i className="fa-solid fa-plus mr-2"></i>Adicionar Material</>
              }
            </button>
          </div>

          {/* ── Gerador IA ─────────────────────────────── */}
          <div className="bg-white border border-pink-500/30 rounded-[24px] p-6 space-y-4">
            <h3 className="text-[#0A1628] font-black uppercase text-sm flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles text-pink-400"></i>Gerar Banner com IA
            </h3>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              A IA cria título, subtítulo e call-to-action. Você imprime ou salva o texto.
            </p>
            <textarea
              value={promptBanner}
              onChange={e => setPromptBanner(e.target.value)}
              rows={4}
              placeholder="Ex: Banner para treinamento de atendimento ao cliente com foco em excelência..."
              className="w-full bg-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-pink-500 resize-none"
            />
            <button type="button" onClick={gerarTextoBanner} disabled={gerando || !promptBanner.trim()}
              className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-[#0A1628] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              {gerando
                ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Gerando...</>
                : <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Gerar Texto</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Preview banner gerado ──────────────────────── */}
      {previewBanner && textoBannerGerado && (() => {
        const { titulo, subtitulo, cta } = parseBannerText(textoBannerGerado);
        return (
          <div className="bg-white border border-pink-500/30 rounded-[24px] p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-[#0A1628] font-black uppercase text-sm">Preview do Banner</h3>
              <button type="button" onClick={() => imprimirBanner(textoBannerGerado)}
                className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-700 px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all">
                <i className="fa-solid fa-print mr-1"></i>Imprimir / PDF
              </button>
            </div>

            <div className="bg-gradient-to-br from-blue-900 to-slate-900 rounded-2xl p-10 text-center space-y-4 border border-blue-500/20">
              <h1 className="text-2xl md:text-4xl font-black text-[#0A1628] uppercase tracking-tight">{titulo || 'Título'}</h1>
              <p className="text-slate-700 text-sm md:text-base leading-relaxed max-w-lg mx-auto">{subtitulo}</p>
              {cta && (
                <div className="inline-block bg-blue-600 text-[#0A1628] px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest">{cta}</div>
              )}
            </div>

            <div className="flex gap-3 flex-wrap">
              <input
                value={tituloBanner}
                onChange={e => setTituloBanner(e.target.value)}
                placeholder="Nome para salvar este banner..."
                className="flex-1 min-w-0 bg-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-pink-500"
              />
              <button type="button" onClick={salvarBannerGerado} disabled={!tituloBanner.trim()}
                className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-[#0A1628] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                <i className="fa-solid fa-floppy-disk mr-2"></i>Salvar
              </button>
              <button type="button" onClick={() => setPreviewBanner(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-700 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                Fechar
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Filtros ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" onClick={() => setFiltroTipo('')}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            !filtroTipo ? 'bg-pink-600 text-[#0A1628]' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'
          }`}>
          Todos ({materiais.length})
        </button>
        {Object.entries(TIPO_CONFIG).map(([id, cfg]) => (
          <button type="button" key={id} onClick={() => setFiltroTipo(filtroTipo === id ? '' : id)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              filtroTipo === id ? 'bg-pink-600 text-[#0A1628]' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'
            }`}>
            <i className={`fa-solid ${cfg.icon} mr-1.5`}></i>{cfg.label}
          </button>
        ))}
      </div>

      {/* ── Galeria ────────────────────────────────────── */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <i className="fa-solid fa-images text-5xl text-slate-600 mb-4"></i>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Nenhum material encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(m => {
            const cfg = TIPO_CONFIG[m.tipo] || TIPO_CONFIG.link;
            return (
              <div key={m.id}
                className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-3 hover:border-slate-200 transition-all">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-${cfg.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                    <i className={`fa-solid ${cfg.icon} text-${cfg.color}-400`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[#0A1628] truncate">{m.titulo}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">{cfg.label}</p>
                  </div>
                </div>

                {/* preview texto banner IA */}
                {m.textoBanner && (
                  <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-3">
                    {m.textoBanner.replace(/TÍTULO:|SUBTÍTULO:|CTA:/g, '').substring(0, 120)}...
                  </p>
                )}

                <div className="flex gap-2">
                  {/* abrir link externo */}
                  {m.linkUrl && (
                    <a href={m.linkUrl} target="_blank" rel="noreferrer"
                      className="flex-1 text-center text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-700 px-3 py-2 rounded-xl font-black uppercase tracking-widest transition-all">
                      <i className="fa-solid fa-arrow-up-right-from-square mr-1"></i>Abrir
                    </a>
                  )}
                  {/* imprimir banner IA */}
                  {m.textoBanner && (
                    <button type="button" onClick={() => imprimirBanner(m.textoBanner)}
                      className="flex-1 text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-700 px-3 py-2 rounded-xl font-black uppercase tracking-widest transition-all">
                      <i className="fa-solid fa-print mr-1"></i>Imprimir
                    </button>
                  )}
                  {isGestor && (
                    <button type="button" title="Excluir material" onClick={() => excluir(m.id)}
                      className="w-8 h-8 bg-slate-900 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-xl flex items-center justify-center transition-all flex-shrink-0">
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
