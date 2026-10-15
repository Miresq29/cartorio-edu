// Player de áudio/vídeo hospedado no Google Drive — o mesmo preview do Drive de sempre, com:
// - o ID do arquivo fora do documento do Repositório que o colaborador lê: vem da function
//   abrirMidia, que confere login e se o conteúdo é visível para o cliente dele;
// - uma capa com selo de cadeado sobre o botão "abrir em nova janela" do Drive (o caminho para
//   baixar) e o clique direito bloqueado.
// Em 2026-10-13 voltou a ser o iframe simples (sem sandbox, sem credentialless, sem <audio>
// próprio): as tentativas de endurecer o player quebravam a reprodução, e a plataforma precisa
// funcionar para todos. Limite conhecido: quem inspecionar a página vê o ID no iframe.
import React, { useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

// streamUrl (só áudio): link temporário da function ouvirAudio — toca sem o download liberado no Drive.
const abrirMidiaFn = httpsCallable<{ midiaId: string }, { embedUrl: string; streamUrl?: string }>(functions, 'abrirMidia');

interface Props {
  midiaId: string;
  titulo: string;
  altura: number | string;
  tipo: 'audio' | 'video' | 'imagem'; // imagem = infográfico (PNG/JPG no Drive, mesmo preview)
}

const PlayerDriveProtegido: React.FC<Props> = ({ midiaId, titulo, altura, tipo }) => {
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');
  const caixaRef = useRef<HTMLDivElement>(null);
  const [telaCheia, setTelaCheia] = useState(false);

  // Tela cheia da própria plataforma (o botão do Drive dentro do iframe nem sempre funciona
  // embutido): coloca o quadro inteiro do player em tela cheia.
  useEffect(() => {
    const aoMudar = () => setTelaCheia(document.fullscreenElement === caixaRef.current);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);
  const alternarTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else caixaRef.current?.requestFullscreen?.().catch(() => {});
  };
  const [streamUrl, setStreamUrl] = useState('');
  // Se o player próprio falhar (ex.: pasta ainda não compartilhada com a plataforma), volta ao preview do Drive.
  const [streamFalhou, setStreamFalhou] = useState(false);
  const usarStream = tipo === 'audio' && !!streamUrl && !streamFalhou;
  const podeTelaCheia = tipo !== 'audio' && typeof document !== 'undefined' && !!document.fullscreenEnabled;

  useEffect(() => {
    let ativo = true;
    setUrl(''); setErro(''); setStreamUrl(''); setStreamFalhou(false);
    abrirMidiaFn({ midiaId })
      .then(r => { if (ativo) { setUrl(r.data.embedUrl); setStreamUrl(r.data.streamUrl || ''); } })
      .catch(e => { if (ativo) setErro(e?.message || 'Não foi possível carregar o conteúdo.'); });
    return () => { ativo = false; };
  }, [midiaId]);

  return (
    <div ref={caixaRef}
      style={{ position: 'relative', borderRadius: telaCheia ? 0 : 16, overflow: 'hidden', background: tipo === 'video' ? '#000' : '#f8fafc',
        ...(tipo === 'video' && !telaCheia ? { aspectRatio: '16 / 9', width: '100%' } : { height: telaCheia ? '100%' : altura }) }}
      onContextMenu={e => e.preventDefault()}>
      {usarStream && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', background: '#0A1628' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fa-solid fa-headphones" style={{ color: '#C9A84C', fontSize: 22 }}></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 800, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</p>
            <audio src={streamUrl} controls controlsList="nodownload noremoteplayback" preload="metadata"
              onError={() => setStreamFalhou(true)} style={{ width: '100%', height: 40 }} />
          </div>
        </div>
      )}
      {url && !usarStream && (
        <iframe
          src={url}
          title={titulo}
          allow={tipo === 'video' ? 'autoplay; fullscreen' : 'autoplay'}
          allowFullScreen={tipo === 'video'}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      )}
      {/* capa sobre o botão "abrir em nova janela" do player do Drive (canto superior direito) */}
      {url && !usarStream && (
        <div aria-hidden="true" title="Conteúdo protegido"
          style={{ position: 'absolute', top: 0, right: 0, width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(10,22,40,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-lock" style={{ color: '#C9A84C', fontSize: 15 }}></i>
          </div>
        </div>
      )}
      {url && podeTelaCheia && (
        <button type="button" onClick={alternarTelaCheia}
          aria-label={telaCheia ? 'Sair da tela cheia' : 'Assistir em tela cheia'} title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
          style={{ position: 'absolute', top: 14, left: 14, height: 40, padding: '0 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'rgba(10,22,40,0.92)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={telaCheia ? 'fa-solid fa-compress' : 'fa-solid fa-expand'} style={{ color: '#C9A84C' }}></i>
          {telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
        </button>
      )}
      {!url && !erro && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Carregando conteúdo...
        </div>
      )}
      {erro && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: 12, padding: 16, textAlign: 'center' }}>
          {erro}
        </div>
      )}
    </div>
  );
};

export default PlayerDriveProtegido;
