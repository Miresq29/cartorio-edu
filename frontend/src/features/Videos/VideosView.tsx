import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';

interface Video {
  id: string;
  titulo: string;
  descricao: string;
  youtubeUrl: string;
  youtubeId: string;
  categoria: string;
  trilhaTitulo: string;
  duracaoMin: number;
  ativo: boolean;
  tenantId: string;
  createdAt: any;
}

const CATEGORIAS = [
  { id: 'onboarding',   label: 'Onboarding',    color: 'emerald', icon: 'fa-door-open'       },
  { id: 'normativo',    label: 'Normativo',      color: 'blue',    icon: 'fa-scale-balanced'  },
  { id: 'tecnico',      label: 'Técnico',        color: 'purple',  icon: 'fa-screwdriver-wrench' },
  { id: 'operacional',  label: 'Operacional',    color: 'amber',   icon: 'fa-gears'           },
  { id: 'comportamental', label: 'Comportamental', color: 'pink',  icon: 'fa-handshake'       },
];

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

const VideosView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(state.user?.role || '');

  const [videos, setVideos] = useState<Video[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [playerVideo, setPlayerVideo] = useState<Video | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assistidos, setAssistidos] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    titulo: '', descricao: '', youtubeUrl: '', categoria: 'onboarding',
    trilhaTitulo: '', duracaoMin: 5,
  });

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, s => setVideos(s.docs.map(d => ({ id: d.id, ...d.data() } as Video)).filter(v => v.ativo !== false)));
  }, []);

  useEffect(() => {
    if (!state.user?.id) return;
    const q = query(collection(db, 'videosProgresso'));
    return onSnapshot(q, s => {
      const ids = new Set<string>();
      s.docs.forEach(d => { if (d.data().userId === state.user!.id && d.data().assistido) ids.add(d.data().videoId); });
      setAssistidos(ids);
    });
  }, [state.user?.id]);

  const videosFiltrados = videos.filter(v => {
    const matchCat = !filtroCategoria || v.categoria === filtroCategoria;
    const matchBusca = !busca || v.titulo.toLowerCase().includes(busca.toLowerCase()) || v.descricao?.toLowerCase().includes(busca.toLowerCase());
    return matchCat && matchBusca;
  });

  const abrirPlayer = async (video: Video) => {
    setPlayerVideo(video);
    if (!state.user?.id) return;
    const key = `${state.user.id}_${video.id}`;
    await setDoc(doc(db, 'videosProgresso', key), {
      userId: state.user.id, videoId: video.id, videoTitulo: video.titulo,
      tenantId: state.user.tenantId, assistido: true, assistidoEm: serverTimestamp(),
    }, { merge: true });
  };

  const salvarVideo = async () => {
    const yid = extractYouTubeId(form.youtubeUrl);
    if (!yid) { showToast('Link do YouTube inválido.', 'error'); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'videos'), {
        ...form, youtubeId: yid, ativo: true,
        tenantId: state.user?.tenantId || '', publicadoPor: state.user?.id || '',
        createdAt: serverTimestamp(),
      });
      showToast('Vídeo adicionado!', 'success');
      setForm({ titulo: '', descricao: '', youtubeUrl: '', categoria: 'onboarding', trilhaTitulo: '', duracaoMin: 5 });
      setShowForm(false);
    } catch { showToast('Erro ao salvar vídeo.', 'error'); } finally { setLoading(false); }
  };

  const excluirVideo = async (id: string) => {
    if (!confirm('Excluir este vídeo?')) return;
    await updateDoc(doc(db, 'videos', id), { ativo: false });
    showToast('Vídeo removido.', 'success');
  };

  const getCatInfo = (id: string) => CATEGORIAS.find(c => c.id === id) || CATEGORIAS[0];

  return (
    <div className="p-8 space-y-6 bg-[#05080f] min-h-screen animate-in fade-in">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
            Vídeos de <span className="text-red-500">Treinamento</span>
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Biblioteca de conteúdo em vídeo</p>
        </div>
        {isGestor && (
          <button onClick={() => setShowForm(!showForm)}
            className="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
            <i className="fa-solid fa-plus"></i> Adicionar Vídeo
          </button>
        )}
      </header>

      {/* Formulário */}
      {showForm && isGestor && (
        <div className="bg-[#0a111f] border border-slate-800 rounded-[24px] p-6 space-y-4">
          <h3 className="text-white font-black uppercase text-sm">Novo Vídeo de Treinamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Título *</label>
              <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ex: Introdução ao Registro de Imóveis"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Link do YouTube *</label>
              <input value={form.youtubeUrl} onChange={e => setForm(p => ({ ...p, youtubeUrl: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Categoria</label>
              <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500">
                {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Trilha Associada (opcional)</label>
              <input value={form.trilhaTitulo} onChange={e => setForm(p => ({ ...p, trilhaTitulo: e.target.value }))}
                placeholder="Ex: Trilha de Atendimento"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Duração (minutos)</label>
              <input type="number" min={1} max={60} value={form.duracaoMin} onChange={e => setForm(p => ({ ...p, duracaoMin: +e.target.value }))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Descrição</label>
              <input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Breve descrição do conteúdo"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={salvarVideo} disabled={loading || !form.titulo || !form.youtubeUrl}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              {loading ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Salvando...</> : <><i className="fa-solid fa-check mr-2"></i>Salvar Vídeo</>}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar vídeo..."
          className="bg-[#0a111f] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500 w-64" />
        <button onClick={() => setFiltroCategoria('')}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!filtroCategoria ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
          Todos
        </button>
        {CATEGORIAS.map(c => (
          <button key={c.id} onClick={() => setFiltroCategoria(filtroCategoria === c.id ? '' : c.id)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filtroCategoria === c.id ? `bg-${c.color}-600 text-white` : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
            <i className={`fa-solid ${c.icon} mr-1.5`}></i>{c.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-500 font-black uppercase tracking-widest">{videosFiltrados.length} vídeo(s)</span>
      </div>

      {/* Grid de vídeos */}
      {videosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <i className="fa-brands fa-youtube text-5xl text-slate-600 mb-4"></i>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Nenhum vídeo encontrado</p>
          {isGestor && <p className="text-slate-600 text-[10px] mt-1">Clique em "Adicionar Vídeo" para começar</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {videosFiltrados.map(v => {
            const cat = getCatInfo(v.categoria);
            const visto = assistidos.has(v.id);
            return (
              <div key={v.id} className={`bg-[#0a111f] border rounded-[24px] overflow-hidden transition-all hover:scale-[1.02] group ${visto ? 'border-emerald-500/30' : 'border-slate-800'}`}>
                {/* Thumbnail */}
                <div className="relative cursor-pointer" onClick={() => abrirPlayer(v)}>
                  <img src={`https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`} alt={v.titulo}
                    className="w-full h-44 object-cover" onError={e => { (e.target as any).style.display='none'; }} />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-xl">
                      <i className="fa-solid fa-play text-white text-xl ml-1"></i>
                    </div>
                  </div>
                  {visto && (
                    <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
                      <i className="fa-solid fa-check mr-1"></i>Assistido
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 bg-black/80 text-white text-[9px] font-black px-2 py-1 rounded-lg">
                    {v.duracaoMin} min
                  </div>
                </div>
                {/* Info */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black text-${cat.color}-400 uppercase tracking-widest bg-${cat.color}-500/10 px-2 py-0.5 rounded-lg`}>
                      <i className={`fa-solid ${cat.icon} mr-1`}></i>{cat.label}
                    </span>
                    {v.trilhaTitulo && (
                      <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-2 py-0.5 rounded-lg truncate">
                        <i className="fa-solid fa-road mr-1"></i>{v.trilhaTitulo}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-white leading-tight">{v.titulo}</h3>
                  {v.descricao && <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{v.descricao}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => abrirPlayer(v)}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      <i className="fa-solid fa-play mr-1"></i>Assistir
                    </button>
                    {isGestor && (
                      <button onClick={() => excluirVideo(v.id)}
                        className="w-9 h-9 bg-slate-900 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-xl flex items-center justify-center transition-all">
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Player */}
      {playerVideo && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPlayerVideo(null)}>
          <div className="w-full max-w-4xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-black text-lg">{playerVideo.titulo}</h3>
              <button onClick={() => setPlayerVideo(null)} className="text-slate-400 hover:text-white w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${playerVideo.youtubeId}?autoplay=1&rel=0`}
                className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen title={playerVideo.titulo} />
            </div>
            {playerVideo.descricao && (
              <p className="text-slate-400 text-sm leading-relaxed">{playerVideo.descricao}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideosView;
