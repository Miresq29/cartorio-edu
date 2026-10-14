// Recurso adicional por cliente (tenants/{id}.acessibilidadeHabilitada, desligado por padrão —
// diferencial para clientes que trabalham com inclusão): VLibras (tradução do texto da tela para
// Libras, widget gratuito do Governo Federal) + barra de acessibilidade (tamanho do texto, alto
// contraste, destaque de links/foco). Preferências da barra ficam no navegador da pessoa.
import React, { useEffect, useState } from 'react';
import { useRecursoTenant } from '../hooks/useRecursoTenant';

const VLIBRAS_SCRIPT = 'https://vlibras.gov.br/app/vlibras-plugin.js';
const VLIBRAS_APP = 'https://vlibras.gov.br/app';
const CHAVE = 'integra-acessibilidade';
const ESCALAS = [1, 1.15, 1.3, 1.5];

interface Prefs { escala: number; contraste: boolean; destaque: boolean }
const PADRAO: Prefs = { escala: 0, contraste: false, destaque: false };

function lerPrefs(): Prefs {
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; } catch { return PADRAO; }
}

function aplicarPrefs(p: Prefs | null) {
  const html = document.documentElement;
  html.style.setProperty('zoom', p && p.escala ? String(ESCALAS[p.escala]) : '');
  html.classList.toggle('a11y-contraste', !!p?.contraste);
  html.classList.toggle('a11y-destaque', !!p?.destaque);
}

// O widget oficial espera a marcação <div vw> no body e inicializa no window.onload — numa SPA o
// script entra depois do load, então o onload registrado pelo widget é disparado manualmente.
function carregarVLibras() {
  if (document.getElementById('vlibras-root')) return;
  const raiz = document.createElement('div');
  raiz.id = 'vlibras-root';
  raiz.setAttribute('vw', '');
  raiz.className = 'enabled';
  raiz.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
  document.body.appendChild(raiz);
  const s = document.createElement('script');
  s.id = 'vlibras-script';
  s.src = VLIBRAS_SCRIPT;
  s.async = true;
  s.onload = () => {
    const w = window as any;
    if (!w.VLibras) return;
    new w.VLibras.Widget(VLIBRAS_APP);
    if (document.readyState === 'complete' && typeof w.onload === 'function') w.onload();
  };
  document.body.appendChild(s);
}

function removerVLibras() {
  document.getElementById('vlibras-root')?.remove();
  document.getElementById('vlibras-script')?.remove();
}

const Acessibilidade: React.FC = () => {
  const { habilitado } = useRecursoTenant('acessibilidadeHabilitada');
  const [aberta, setAberta] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(lerPrefs);

  useEffect(() => {
    if (!habilitado) { removerVLibras(); aplicarPrefs(null); return; }
    carregarVLibras();
    aplicarPrefs(prefs);
  }, [habilitado]); // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = (p: Partial<Prefs>) => {
    const novo = { ...prefs, ...p };
    setPrefs(novo);
    aplicarPrefs(novo);
    try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch { /* sem armazenamento: vale só nesta sessão */ }
  };

  if (!habilitado) return null;

  const botao = 'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border';
  return (
    <div className="fixed bottom-4 left-4 z-[60]" role="region" aria-label="Recursos de acessibilidade">
      {aberta && (
        <div id="painel-acessibilidade" className="mb-3 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-navy">Acessibilidade</p>
            <button onClick={() => setAberta(false)} aria-label="Fechar painel de acessibilidade" className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-lg">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1.5">Tamanho do texto</p>
            <div className="flex gap-2" role="group" aria-label="Tamanho do texto">
              <button onClick={() => mudar({ escala: Math.max(0, prefs.escala - 1) })} disabled={prefs.escala === 0}
                aria-label="Diminuir texto" className="flex-1 py-2 rounded-xl border border-slate-200 font-black text-navy disabled:opacity-40">A−</button>
              <span className="flex-1 py-2 text-center text-sm font-bold text-slate-600" aria-live="polite">{Math.round(ESCALAS[prefs.escala] * 100)}%</span>
              <button onClick={() => mudar({ escala: Math.min(ESCALAS.length - 1, prefs.escala + 1) })} disabled={prefs.escala === ESCALAS.length - 1}
                aria-label="Aumentar texto" className="flex-1 py-2 rounded-xl border border-slate-200 font-black text-navy text-lg disabled:opacity-40">A+</button>
            </div>
          </div>
          <button onClick={() => mudar({ contraste: !prefs.contraste })} aria-pressed={prefs.contraste}
            className={`${botao} ${prefs.contraste ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-slate-200'}`}>
            <span><i className="fa-solid fa-circle-half-stroke mr-2" aria-hidden="true"></i>Alto contraste</span>
            <span className="text-xs">{prefs.contraste ? 'Ligado' : 'Desligado'}</span>
          </button>
          <button onClick={() => mudar({ destaque: !prefs.destaque })} aria-pressed={prefs.destaque}
            className={`${botao} ${prefs.destaque ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-slate-200'}`}>
            <span><i className="fa-solid fa-highlighter mr-2" aria-hidden="true"></i>Destacar links e foco</span>
            <span className="text-xs">{prefs.destaque ? 'Ligado' : 'Desligado'}</span>
          </button>
          <button onClick={() => mudar(PADRAO)} className="w-full text-xs font-bold text-slate-500 hover:text-navy py-1">Restaurar padrão</button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Para tradução em Libras, use o botão azul do VLibras no canto direito da tela.
          </p>
        </div>
      )}
      <button onClick={() => setAberta(a => !a)} aria-expanded={aberta} aria-controls="painel-acessibilidade"
        aria-label="Abrir recursos de acessibilidade" title="Acessibilidade"
        className="w-14 h-14 rounded-full bg-navy text-white shadow-xl flex items-center justify-center border-2 border-gold hover:scale-105 transition-all">
        <i className="fa-solid fa-universal-access text-2xl" aria-hidden="true"></i>
      </button>
    </div>
  );
};

export default Acessibilidade;
