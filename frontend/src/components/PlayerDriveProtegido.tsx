// Player de áudio/vídeo hospedado no Google Drive, com o máximo de proteção possível sem tirar
// o arquivo do Drive:
// - o ID do arquivo não fica mais no documento do Repositório que o colaborador lê — vem da
//   function abrirMidia, que confere login e se o conteúdo é visível para o cliente dele;
// - vídeo: o iframe roda em sandbox SEM allow-popups — o botão "abrir em nova janela" do
//   Drive (o caminho para baixar o arquivo) não abre nada, inclusive em tela cheia;
// - áudio: NÃO usa o preview do Drive (que só toca áudio com o download liberado e mesmo assim
//   carregava uma tela inteira) — usa o <audio> do site com o endereço direto do arquivo,
//   sem botão de download; exige o download liberado para leitores no Drive;
// - vídeo: uma capa com selo de cadeado cobre esse botão; clique direito bloqueado.
// Limite conhecido: enquanto o arquivo estiver compartilhado publicamente no Drive, quem
// inspecionar a página ainda consegue ver o ID no iframe carregado.
import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

const abrirMidiaFn = httpsCallable<{ midiaId: string }, { embedUrl: string; audioUrl?: string }>(functions, 'abrirMidia');

interface Props {
  midiaId: string;
  titulo: string;
  altura: number | string;
  tipo: 'audio' | 'video';
}

const PlayerDriveProtegido: React.FC<Props> = ({ midiaId, titulo, altura, tipo }) => {
  const [url, setUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setUrl(''); setAudioUrl(''); setErro('');
    abrirMidiaFn({ midiaId })
      .then(r => { if (ativo) { setUrl(r.data.embedUrl); setAudioUrl(r.data.audioUrl || ''); } })
      .catch(e => { if (ativo) setErro(e?.message || 'Não foi possível carregar o conteúdo.'); });
    return () => { ativo = false; };
  }, [midiaId]);

  // Áudio: player simples do próprio site (play com um clique), sem botão de download nem
  // menu do navegador. O preview do Drive para áudio carregava uma tela inteira e falhava.
  if (tipo === 'audio') {
    return (
      <div style={{ position: 'relative', height: altura, borderRadius: 16, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        onContextMenu={e => e.preventDefault()}>
        {audioUrl && !erro && (
          <audio
            src={audioUrl}
            controls
            preload="metadata"
            controlsList="nodownload noplaybackrate"
            title={titulo}
            style={{ width: '100%' }}
            onError={() => setErro('Este áudio ainda está com o download bloqueado no Google Drive — a gestão precisa liberá-lo para que ele possa ser ouvido aqui.')}
          />
        )}
        {!audioUrl && !erro && (
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Carregando áudio...
          </span>
        )}
        {erro && <span style={{ color: '#dc2626', fontSize: 12, textAlign: 'center' }}>{erro}</span>}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: altura, borderRadius: 16, overflow: 'hidden', background: '#f8fafc' }}
      onContextMenu={e => e.preventDefault()}>
      {url && (
        <iframe
          src={url}
          title={titulo}
          allow="autoplay; fullscreen"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      )}
      {/* capa sobre o botão "abrir em nova janela" do player do Drive (canto superior direito):
          a área toda bloqueia o clique e um selo de cadeado esconde o ícone do Drive. */}
      {url && (
        <div aria-hidden="true" title="Conteúdo protegido"
          style={{ position: 'absolute', top: 0, right: 0, width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(10,22,40,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-lock" style={{ color: '#C9A84C', fontSize: 15 }}></i>
          </div>
        </div>
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
