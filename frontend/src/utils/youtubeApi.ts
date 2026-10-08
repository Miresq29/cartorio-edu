// Carrega a IFrame Player API do YouTube uma única vez por sessão — permite anexar a um
// <iframe> já existente (desde que tenha enablejsapi=1 na URL) e escutar o evento de
// "vídeo terminou" via postMessage, sem precisar abrir mão do sandbox do iframe.
let apiPromise: Promise<any> | null = null;

export function loadYouTubeApi(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise(resolve => {
    const anterior = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      anterior?.();
      resolve(w.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return apiPromise;
}
