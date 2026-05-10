// frontend/src/features/Repositorio/RepositorioView.tsx
// Repositório de Mídias: YouTube, Áudio e PDF via Google Drive (gratuito)
// Admin faz upload no Drive e cola o link aqui — sem custos de storage

import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type MidiaTipo = 'youtube' | 'audio' | 'mp4';

interface Midia {
  id: string;
  titulo: string;
  descricao: string;
  tipo: MidiaTipo;
  categoria: string;
  trilhaTitulo: string;
  duracaoMin: number;
  ativo: boolean;
  tenantId: string;
  createdAt: any;
  // YouTube
  youtubeId?: string;
  // Drive (áudio / PDF)
  driveUrl?: string;
  driveId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { id: 'onboarding',     label: 'Onboarding',    color: 'emerald', icon: 'fa-door-open'          },
  { id: 'normativo',      label: 'Normativo',     color: 'blue',    icon: 'fa-scale-balanced'     },
  { id: 'tecnico',        label: 'Técnico',       color: 'purple',  icon: 'fa-screwdriver-wrench' },
  { id: 'operacional',    label: 'Operacional',   color: 'amber',   icon: 'fa-gears'              },
  { id: 'comportamental', label: 'Comportamental',color: 'pink',    icon: 'fa-handshake'          },
];

const TIPO_CONFIG: Record<MidiaTipo, { label: string; icon: string; color: string; desc: string }> = {
  youtube: { label: 'Vídeo YouTube', icon: 'fa-brands fa-youtube',   color: 'red',    desc: 'Cole o link do YouTube'                          },
  audio:   { label: 'Áudio Drive',   icon: 'fa-solid fa-headphones', color: 'violet', desc: 'Cole o link de compartilhamento do Google Drive' },
  mp4:     { label: 'Video Drive',   icon: 'fa-solid fa-circle-play', color: 'teal',   desc: 'Cole o link de compartilhamento do Google Drive' },
};

// Extrai o ID de vídeo do YouTube
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Extrai o ID de arquivo do Google Drive de qualquer formato de link
function extractDriveId(url: string): string | null {
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Converte link Drive em URL de embed para PDF
function driveEmbedUrl(driveId: string): string {
  return `https://drive.google.com/file/d/${driveId}/preview`;
}

// Converte link Drive em URL de player de áudio (iframe)
function driveAudioUrl(driveId: string): string {
  return `https://drive.google.com/file/d/${driveId}/preview`;
}

// Valida e normaliza o link colado pelo admin
function processarLink(url: string, tipo: MidiaTipo): { youtubeId?: string; driveId?: string; valid: boolean; erro?: string } {
  if (tipo === 'youtube') {
    const yid = extractYouTubeId(url);
    if (!yid) return { valid: false, erro: 'Link do YouTube inválido. Use o formato: https://youtube.com/watch?v=...' };
    return { youtubeId: yid, valid: true };
  }
  // áudio ou PDF — precisa ser Google Drive
  const did = extractDriveId(url);
  if (!did) return { valid: false, erro: 'Link do Google Drive inválido. Use o botão "Compartilhar" do Drive e copie o link.' };
  return { driveId: did, valid: true };
}

// ─── Player Modal ─────────────────────────────────────────────────────────────

const PlayerModal: React.FC<{
  midia: Midia;
  onClose: () => void;
}> = ({ midia, onClose }) => {
  const tipo = TIPO_CONFIG[midia.tipo];

  const renderContent = () => {
    if (midia.tipo === 'youtube' && midia.youtubeId) {
      return (
        <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${midia.youtubeId}?autoplay=1&rel=0`}
            className="w-full h-full"
            allow="autoplay; fullscreen"
            allowFullScreen
            title={midia.titulo}
          />
        </div>
      );
    }

    if (midia.tipo === 'mp4' && midia.driveId) {
      return (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden shadow-2xl bg-slate-900" style={{ height: '70vh' }}>
            <iframe
              src={driveEmbedUrl(midia.driveId)}
              className="w-full h-full"
              allow="autoplay"
              title={midia.titulo}
            />
          </div>
          <a
            href={`https://drive.google.com/file/d/${midia.driveId}/view`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[10px] bg-rose-600 hover:bg-rose-500 text-[#0A1628] px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all"
          >
            <i className="fa-solid fa-arrow-up-right-from-square"></i>Abrir no Google Drive
          </a>
        </div>
      );
    }

    if (midia.tipo === 'audio' && midia.driveId) {
      return (
        <div className="space-y-4">
          {/* Player iframe do Drive */}
          <div className="rounded-2xl overflow-hidden bg-slate-900" style={{ height: '120px' }}>
            <iframe
              src={driveAudioUrl(midia.driveId)}
              className="w-full h-full"
              allow="autoplay"
              title={midia.titulo}
            />
          </div>
          {/* Fallback: link direto */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center space-y-2">
            <i className="fa-solid fa-headphones text-violet-400 text-3xl block mb-2"></i>
            <p className="text-xs text-slate-500">Se o player não carregar, abra diretamente no Drive:</p>
            <a
              href={`https://drive.google.com/file/d/${midia.driveId}/view`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-[10px] bg-violet-600 hover:bg-violet-500 text-[#0A1628] px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all"
            >
              <i className="fa-brands fa-google-drive"></i>Ouvir no Google Drive
            </a>
          </div>
        </div>
      );
    }

    return <p className="text-slate-500 text-sm text-center py-8">Conteúdo indisponível.</p>;
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className={`${tipo.icon} text-${tipo.color}-400 text-lg`}></i>
            <h3 className="text-[#0A1628] font-black text-lg">{midia.titulo}</h3>
          </div>
          <button onClick={onClose}
            className="text-slate-500 hover:text-[#0A1628] w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center transition-all">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        {renderContent()}
        {midia.descricao && (
          <p className="text-slate-500 text-sm leading-relaxed">{midia.descricao}</p>
        )}
      </div>
    </div>
  );
};

// ─── Card de Mídia ────────────────────────────────────────────────────────────

const MidiaCard: React.FC<{
  midia: Midia;
  assistida: boolean;
  isGestor: boolean;
  onPlay: () => void;
  onDelete: () => void;
}> = ({ midia, assistida, isGestor, onPlay, onDelete }) => {
  const cat = CATEGORIAS.find(c => c.id === midia.categoria) || CATEGORIAS[0];
  const tipo = TIPO_CONFIG[midia.tipo];

  return (
    <div className={`bg-white border rounded-[20px] overflow-hidden transition-all hover:scale-[1.01] group ${
      assistida ? 'border-emerald-500/30' : 'border-slate-200'
    }`}>
      {/* Thumbnail */}
      <div className="relative cursor-pointer" onClick={onPlay}>
        {midia.tipo === 'youtube' && midia.youtubeId ? (
          <>
            <img
              src={`https://img.youtube.com/vi/${midia.youtubeId}/hqdefault.jpg`}
              alt={midia.titulo}
              className="w-full h-40 object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
              <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-xl">
                <i className="fa-solid fa-play text-[#0A1628] text-xl ml-1"></i>
              </div>
            </div>
          </>
        ) : (
          <div className={`w-full h-40 flex items-center justify-center bg-gradient-to-br ${
            midia.tipo === 'audio'
              ? 'from-violet-900/40 to-slate-900'
              : 'from-rose-900/40 to-slate-900'
          }`}>
            <div className="text-center space-y-2">
              <i className={`${tipo.icon} text-5xl text-${tipo.color}-400 opacity-70`}></i>
              <p className={`text-[10px] font-black uppercase tracking-widest text-${tipo.color}-400 opacity-70`}>
                {tipo.label}
              </p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/30">
              <div className={`w-14 h-14 bg-${tipo.color}-600 rounded-full flex items-center justify-center shadow-xl`}>
                <i className={`fa-solid ${midia.tipo === 'mp4' ? 'fa-eye' : 'fa-play'} text-[#0A1628] text-xl ${midia.tipo !== 'mp4' ? 'ml-1' : ''}`}></i>
              </div>
            </div>
          </div>
        )}

        {/* Badges */}
        {assistida && (
          <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
            <i className="fa-solid fa-check mr-1"></i>Visto
          </div>
        )}
        {midia.duracaoMin > 0 && (
          <div className="absolute bottom-3 right-3 bg-black/80 text-[#0A1628] text-[9px] font-black px-2 py-1 rounded-lg">
            {midia.duracaoMin} min
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[9px] font-black text-${cat.color}-400 uppercase tracking-widest bg-${cat.color}-500/10 px-2 py-0.5 rounded-lg`}>
            <i className={`fa-solid ${cat.icon} mr-1`}></i>{cat.label}
          </span>
          <span className={`text-[9px] font-black text-${tipo.color}-400 uppercase tracking-widest bg-${tipo.color}-500/10 px-2 py-0.5 rounded-lg`}>
            <i className={`${tipo.icon} mr-1`}></i>{tipo.label}
          </span>
          {midia.trilhaTitulo && (
            <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-2 py-0.5 rounded-lg truncate max-w-[120px]">
              <i className="fa-solid fa-road mr-1"></i>{midia.trilhaTitulo}
            </span>
          )}
        </div>
        <h3 className="text-sm font-black text-[#0A1628] leading-tight">{midia.titulo}</h3>
        {midia.descricao && (
          <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{midia.descricao}</p>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onPlay}
            className={`flex-1 bg-${tipo.color}-600 hover:bg-${tipo.color}-500 text-[#0A1628] py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all`}>
            <i className={`fa-solid ${midia.tipo === 'mp4' ? 'fa-eye' : 'fa-play'} mr-1`}></i>
            {midia.tipo === 'mp4' ? 'Visualizar' : 'Abrir'}
          </button>
          {isGestor && (
            <button onClick={onDelete}
              className="w-9 h-9 bg-slate-900 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-xl flex items-center justify-center transition-all flex-shrink-0">
              <i className="fa-solid fa-trash text-xs"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Formulário de Adição ─────────────────────────────────────────────────────

const FormMidia: React.FC<{
  onSave: (data: Omit<Midia, 'id' | 'tenantId' | 'createdAt' | 'ativo'>) => Promise<void>;
  onCancel: () => void;
}> = ({ onSave, onCancel }) => {
  const [tipo, setTipo] = useState<MidiaTipo>('youtube');
  const [form, setForm] = useState({
    titulo: '', descricao: '', categoria: 'onboarding',
    trilhaTitulo: '', duracaoMin: 5, link: '',
  });
  const [linkErro, setLinkErro] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSalvar = async () => {
    if (!form.titulo.trim() || !form.link.trim()) {
      setLinkErro('Preencha o título e o link.');
      return;
    }
    const result = processarLink(form.link.trim(), tipo);
    if (!result.valid) {
      setLinkErro(result.erro || 'Link inválido.');
      return;
    }
    setLinkErro('');
    setSaving(true);
    try {
      await onSave({
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        tipo,
        categoria: form.categoria,
        trilhaTitulo: form.trilhaTitulo.trim(),
        duracaoMin: Number(form.duracaoMin),
        youtubeId: result.youtubeId,
        driveId: result.driveId,
        driveUrl: tipo !== 'youtube' ? form.link.trim() : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0D1B3E] border border-blue-500/30 rounded-2xl p-6 space-y-5">
      <h4 className="text-blue-400 font-black uppercase text-xs tracking-widest">Adicionar Conteúdo ao Repositório</h4>

      {/* Tipo */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Tipo de Conteúdo</label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(TIPO_CONFIG) as [MidiaTipo, typeof TIPO_CONFIG[MidiaTipo]][]).map(([key, cfg]) => (
            <button type="button" key={key} onClick={() => { setTipo(key); setLinkErro(''); set('link', ''); }}
              className={`p-3 rounded-xl border text-center transition-all ${
                tipo === key ? `border-${cfg.color}-500 bg-${cfg.color}-500/10` : 'border-slate-200 hover:border-slate-600'
              }`}>
              <i className={`${cfg.icon} text-xl mb-1 block ${tipo === key ? `text-${cfg.color}-400` : 'text-slate-500'}`}></i>
              <p className={`text-[10px] font-black ${tipo === key ? `text-${cfg.color}-300` : 'text-slate-500'}`}>{cfg.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Instrução de como obter o link */}
      {tipo !== 'youtube' && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
            <i className="fa-brands fa-google-drive mr-1.5"></i>Como obter o link do Google Drive
          </p>
          <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
            <li>Faça upload do arquivo no Google Drive</li>
            <li>Clique com o botão direito no arquivo → <strong className="text-[#0A1628]">Compartilhar</strong></li>
            <li>Em "Acesso geral", selecione <strong className="text-[#0A1628]">"Qualquer pessoa com o link"</strong></li>
            <li>Clique em <strong className="text-[#0A1628]">Copiar link</strong> e cole abaixo</li>
          </ol>
        </div>
      )}

      {/* Link */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          {tipo === 'youtube' ? 'Link do YouTube *' : 'Link de Compartilhamento do Google Drive *'}
        </label>
        <input
          value={form.link}
          onChange={e => { set('link', e.target.value); setLinkErro(''); }}
          placeholder={tipo === 'youtube'
            ? 'https://youtube.com/watch?v=...'
            : 'https://drive.google.com/file/d/.../view?usp=sharing'
          }
          className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none transition-all ${
            linkErro ? 'border-red-500' : 'border-slate-200 focus:border-blue-500'
          }`}
        />
        {linkErro && <p className="text-xs text-red-400">{linkErro}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Título */}
        <div className="space-y-1 md:col-span-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Título *</label>
          <input value={form.titulo} onChange={e => set('titulo', e.target.value)}
            placeholder="Ex: Introdução ao Provimento 213/2026"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
        </div>

        {/* Categoria */}
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Categoria</label>
          <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500">
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        {/* Duração */}
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Duração (minutos)</label>
          <input type="number" min={1} max={300} value={form.duracaoMin} onChange={e => set('duracaoMin', e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
        </div>

        {/* Trilha */}
        <div className="space-y-1 md:col-span-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Trilha Associada (opcional)</label>
          <input value={form.trilhaTitulo} onChange={e => set('trilhaTitulo', e.target.value)}
            placeholder="Ex: Trilha do Atendente"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
        </div>

        {/* Descrição */}
        <div className="space-y-1 md:col-span-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Descrição</label>
          <input value={form.descricao} onChange={e => set('descricao', e.target.value)}
            placeholder="Breve descrição do conteúdo"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 hover:border-slate-600 transition-all">
          Cancelar
        </button>
        <button onClick={handleSalvar} disabled={saving || !form.titulo || !form.link}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
          {saving
            ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Salvando...</>
            : <><i className="fa-solid fa-floppy-disk mr-2"></i>Adicionar ao Repositório</>
          }
        </button>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const RepositorioView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const user = state.user!;
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(user.role);

  const [midias, setMidias] = useState<Midia[]>([]);
  const [assistidas, setAssistidas] = useState<Set<string>>(new Set());
  const [filtroTipo, setFiltroTipo] = useState<MidiaTipo | ''>('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [playerMidia, setPlayerMidia] = useState<Midia | null>(null);

  // Load mídias
  useEffect(() => {
    const q = query(collection(db, 'repositorio'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, s =>
      setMidias(s.docs.map(d => ({ id: d.id, ...d.data() } as Midia)).filter(m => m.ativo !== false))
    );
  }, []);

  // Load progresso (assistidas)
  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'repositorioProgresso'));
    return onSnapshot(q, s => {
      const ids = new Set<string>();
      s.docs.forEach(d => {
        if (d.data().userId === user.id && d.data().visto) ids.add(d.data().midiaId);
      });
      setAssistidas(ids);
    });
  }, [user?.id]);

  const abrirPlayer = async (midia: Midia) => {
    setPlayerMidia(midia);
    if (!user?.id) return;
    const key = `${user.id}_${midia.id}`;
    await setDoc(doc(db, 'repositorioProgresso', key), {
      userId: user.id, midiaId: midia.id, midiaTitle: midia.titulo,
      tenantId: user.tenantId, visto: true, vistoEm: serverTimestamp(),
    }, { merge: true });
  };

  const handleSave = async (data: Omit<Midia, 'id' | 'tenantId' | 'createdAt' | 'ativo'>) => {
    await addDoc(collection(db, 'repositorio'), {
      ...data, ativo: true,
      tenantId: user.tenantId, criadoPor: user.id,
      createdAt: serverTimestamp(),
    });
    showToast('Conteúdo adicionado ao repositório!', 'success');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este conteúdo do repositório?')) return;
    await updateDoc(doc(db, 'repositorio', id), { ativo: false });
    showToast('Conteúdo removido.', 'success');
  };

  // Filtros
  const filtradas = midias.filter(m => {
    const matchTipo = !filtroTipo || m.tipo === filtroTipo;
    const matchCat = !filtroCategoria || m.categoria === filtroCategoria;
    const matchBusca = !busca ||
      m.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      m.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
      m.trilhaTitulo?.toLowerCase().includes(busca.toLowerCase());
    return matchTipo && matchCat && matchBusca;
  });

  // Stats
  const totalVideos = midias.filter(m => m.tipo === 'youtube').length;
  const totalAudios = midias.filter(m => m.tipo === 'audio').length;
  const totalPDFs   = midias.filter(m => m.tipo === 'mp4').length;
  const totalVistos = assistidas.size;

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">

      {/* Player Modal */}
      {playerMidia && (
        <PlayerModal midia={playerMidia} onClose={() => setPlayerMidia(null)} />
      )}

      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-[#0D1B3E] italic uppercase tracking-tighter">
            Repositório de <span className="text-blue-500">Conteúdo</span>
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
            Vídeos · Áudios · PDFs — Google Drive & YouTube
          </p>
        </div>
        {isGestor && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
            <i className="fa-solid fa-plus"></i>Adicionar
          </button>
        )}
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Vídeos',         value: totalVideos, icon: 'fa-brands fa-youtube',   color: 'red'    },
          { label: 'Áudios',         value: totalAudios, icon: 'fa-solid fa-headphones', color: 'violet' },
          { label: 'Videos',           value: totalPDFs,   icon: 'fa-solid fa-file-pdf',   color: 'rose'   },
          { label: 'Vistos por mim', value: totalVistos, icon: 'fa-solid fa-circle-check',color: 'emerald'},
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-2">
            <i className={`${s.icon} text-${s.color}-500`}></i>
            <p className="text-2xl font-black text-[#0A1628]">{s.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Formulário */}
      {showForm && (
        <FormMidia onSave={handleSave} onCancel={() => setShowForm(false)} />
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar conteúdo..."
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 w-56" />

        {/* Filtro tipo */}
        <div className="flex gap-2">
          <button onClick={() => setFiltroTipo('')}
            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
              !filtroTipo ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500 hover:bg-slate-800 border border-slate-200'
            }`}>Todos</button>
          {(Object.entries(TIPO_CONFIG) as [MidiaTipo, typeof TIPO_CONFIG[MidiaTipo]][]).map(([key, cfg]) => (
            <button key={key} onClick={() => setFiltroTipo(filtroTipo === key ? '' : key)}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                filtroTipo === key
                  ? `bg-${cfg.color}-600 text-[#0A1628]`
                  : 'bg-slate-900 text-slate-500 hover:bg-slate-800 border border-slate-200'
              }`}>
              <i className={`${cfg.icon} text-[10px]`}></i>{cfg.label}
            </button>
          ))}
        </div>

        {/* Filtro categoria */}
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[10px] text-slate-700 outline-none focus:border-blue-500">
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        <span className="ml-auto text-[10px] text-slate-500 font-black uppercase tracking-widest">
          {filtradas.length} item{filtradas.length !== 1 ? 'ns' : ''}
        </span>
      </div>

      {/* Grid */}
      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <i className="fa-solid fa-photo-film text-5xl text-slate-600 mb-4"></i>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Nenhum conteúdo encontrado</p>
          {isGestor && <p className="text-slate-600 text-[10px] mt-1">Clique em "Adicionar" para inserir o primeiro conteúdo</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtradas.map(m => (
            <MidiaCard
              key={m.id}
              midia={m}
              assistida={assistidas.has(m.id)}
              isGestor={isGestor}
              onPlay={() => abrirPlayer(m)}
              onDelete={() => handleDelete(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RepositorioView;
