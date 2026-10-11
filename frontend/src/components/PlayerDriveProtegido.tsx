// Player de áudio/vídeo hospedado no Google Drive, com o máximo de proteção possível sem tirar
// o arquivo do Drive:
// - o ID do arquivo não fica mais no documento do Repositório que o colaborador lê — vem da
//   function abrirMidia, que confere login e se o conteúdo é visível para o cliente dele;
// - o iframe roda em sandbox SEM allow-popups: o botão "abrir em nova janela" do Drive (o
//   caminho para baixar o arquivo) não abre nada;
// - uma capa transparente cobre esse botão e o clique direito fica bloqueado sobre o player.
// Limite conhecido: enquanto o arquivo estiver compartilhado publicamente no Drive, quem
// inspecionar a página ainda consegue ver o ID no iframe carregado.
import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

const abrirMidiaFn = httpsCallable<{ midiaId: string }, { embedUrl: string }>(functions, 'abrirMidia');

interface Props {
  midiaId: string;
  titulo: string;
  altura: number | string;
}

const PlayerDriveProtegido: React.FC<Props> = ({ midiaId, titulo, altura }) => {
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setUrl(''); setErro('');
    abrirMidiaFn({ midiaId })
      .then(r => { if (ativo) setUrl(r.data.embedUrl); })
      .catch(e => { if (ativo) setErro(e?.message || 'Não foi possível carregar o conteúdo.'); });
    return () => { ativo = false; };
  }, [midiaId]);

  return (
    <div style={{ position: 'relative', height: altura, borderRadius: 16, overflow: 'hidden', background: '#f8fafc' }}
      onContextMenu={e => e.preventDefault()}>
      {url && (
        <iframe
          src={url}
          title={titulo}
          allow="autoplay"
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
