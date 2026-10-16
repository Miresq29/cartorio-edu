// Tema por cliente ("Marca própria", recurso habilitado pela equipe MJ em Gestão de Empresas).
// As cores da identidade são variáveis CSS com os canais "R G B" (para o Tailwind aceitar
// transparência: rgb(var(--c-gold) / 0.2)). Sem marca, valem os padrões de index.css — o visual
// MJ de sempre. Com marca, tudo é derivado de DUAS cores do cliente e ajustado para contraste
// WCAG AA: texto branco sobre a cor principal, texto escuro sobre a cor de destaque, tons de
// destaque legíveis sobre fundo branco e textos do menu legíveis sobre o fundo do menu.

export interface MarcaCliente {
  corPrimaria?: string;   // ex.: '#0A1628' — menu, cabeçalhos, botões escuros
  corDestaque?: string;   // ex.: '#C9A84C' — realces, ícones, botões de destaque
  logo?: string;          // data URL (PNG/WebP reduzido no cadastro)
  nomeExibicao?: string;  // nome mostrado no topo do menu (padrão: nome do cliente)
}

type RGB = [number, number, number];

export const CORES_PADRAO = { corPrimaria: '#0A1628', corDestaque: '#C9A84C' };

// Variáveis controladas pelo tema (os padrões estão em index.css).
export const VARS_TEMA = [
  'c-navy', 'c-navy-2', 'c-on-navy', 'c-gold', 'c-on-gold', 'c-gold-bg', 'c-gold-line',
  'c-gold-strong', 'c-gold-body', 'c-gold-soft',
  'c-bg-base', 'c-bg-surface', 'c-bg-elevated', 'c-bg-overlay',
  'c-text-primary', 'c-text-secondary', 'c-text-muted', 'c-text-disabled',
  'c-blue-50', 'c-blue-100', 'c-blue-200', 'c-blue-300', 'c-blue-400', 'c-blue-500',
  'c-blue-600', 'c-blue-700', 'c-blue-800', 'c-blue-900', 'c-blue-950',
] as const;

export function hexParaRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
}
export const rgbParaHex = (c: RGB) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const canais = (c: RGB) => c.map(v => Math.round(v)).join(' ');

function luminancia([r, g, b]: RGB): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contraste(a: RGB, b: RGB): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const misturar = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t) as RGB;
const BRANCO: RGB = [255, 255, 255];
const PRETO: RGB = [0, 0, 0];

// Aproxima a cor de branco ou preto (o que der contraste) até atingir a razão mínima sobre o fundo.
function comContraste(cor: RGB, fundo: RGB, minimo: number): RGB {
  if (contraste(cor, fundo) >= minimo) return cor;
  const alvo = luminancia(fundo) > 0.4 ? PRETO : BRANCO;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = misturar(cor, alvo, t);
    if (contraste(c, fundo) >= minimo) return c;
  }
  return alvo;
}

// Calcula todas as variáveis a partir das duas cores do cliente.
export function calcularTema(marca: MarcaCliente): Record<string, string> {
  // Principal: precisa aguentar texto branco (menu, cabeçalhos, botões) — escurece se for clara.
  const primaria = comContraste(hexParaRgb(marca.corPrimaria || '') || hexParaRgb(CORES_PADRAO.corPrimaria)!, BRANCO, 4.5);
  // Destaque: usado como fundo de botões com texto na cor principal e como realce sobre o menu.
  const destaqueBase = hexParaRgb(marca.corDestaque || '') || hexParaRgb(CORES_PADRAO.corDestaque)!;
  const destaque = comContraste(destaqueBase, primaria, 4.5);
  const fundoMenu = primaria;
  return {
    'c-navy': canais(primaria),
    'c-navy-2': canais(misturar(primaria, BRANCO, 0.14)),
    'c-on-navy': canais(BRANCO),
    'c-gold': canais(destaque),
    'c-on-gold': canais(contraste(primaria, destaque) >= 4.5 ? primaria : comContraste(PRETO, destaque, 4.5)),
    'c-gold-bg': canais(misturar(destaqueBase, BRANCO, 0.86)),
    'c-gold-line': canais(misturar(destaqueBase, BRANCO, 0.6)),
    'c-gold-strong': canais(comContraste(destaqueBase, BRANCO, 5.5)),
    'c-gold-body': canais(comContraste(destaqueBase, BRANCO, 4.5)),
    'c-gold-soft': canais(comContraste(destaqueBase, BRANCO, 3.2)),
    'c-bg-base': canais(fundoMenu),
    'c-bg-surface': canais(misturar(fundoMenu, BRANCO, 0.07)),
    'c-bg-elevated': canais(misturar(fundoMenu, BRANCO, 0.12)),
    'c-bg-overlay': canais(misturar(fundoMenu, PRETO, 0.2)),
    'c-text-primary': canais(comContraste([226, 232, 240], fundoMenu, 7)),
    'c-text-secondary': canais(comContraste(destaque, fundoMenu, 4.5)),
    'c-text-muted': canais(comContraste(misturar(destaque, fundoMenu, 0.25), fundoMenu, 4.5)),
    'c-text-disabled': canais(misturar(destaque, fundoMenu, 0.55)),
    // Escala "azul" (ações e item ativo do menu) a partir da cor principal: tons claros para
    // fundos suaves; 500–950 sempre com texto branco legível; 400 legível sobre o menu.
    'c-blue-50': canais(misturar(primaria, BRANCO, 0.94)),
    'c-blue-100': canais(misturar(primaria, BRANCO, 0.88)),
    'c-blue-200': canais(misturar(primaria, BRANCO, 0.76)),
    'c-blue-300': canais(misturar(primaria, BRANCO, 0.6)),
    'c-blue-400': canais(comContraste(misturar(primaria, BRANCO, 0.45), fundoMenu, 4.5)),
    'c-blue-500': canais(comContraste(misturar(primaria, BRANCO, 0.22), BRANCO, 4.5)),
    'c-blue-600': canais(comContraste(misturar(primaria, BRANCO, 0.1), BRANCO, 4.5)),
    'c-blue-700': canais(comContraste(primaria, BRANCO, 5.5)),
    'c-blue-800': canais(misturar(primaria, PRETO, 0.15)),
    'c-blue-900': canais(misturar(primaria, PRETO, 0.3)),
    'c-blue-950': canais(misturar(primaria, PRETO, 0.45)),
  };
}

export function aplicarTema(vars: Record<string, string> | null) {
  const raiz = document.documentElement;
  for (const v of VARS_TEMA) {
    if (vars && vars[v]) raiz.style.setProperty('--' + v, vars[v]);
    else raiz.style.removeProperty('--' + v);
  }
}

// Bloco :root com os valores em uso — vai no <style> das janelas de impressão/PDF, que não
// herdam as variáveis da plataforma.
export function cssVarsTema(): string {
  const cs = getComputedStyle(document.documentElement);
  return ':root{' + VARS_TEMA.map(v => `--${v}:${cs.getPropertyValue('--' + v).trim()};`).join('') + '}';
}

// Logo do cliente em uso (para certificados e PDFs); vazio quando não há marca.
let logoAtual = '';
export const definirLogoAtual = (l: string) => { logoAtual = l; };
export const logoTema = () => logoAtual;

// Cor com transparência que funciona tanto para hex ('#4F46E5' + '20') quanto para cor de tema
// ('rgb(var(--c-gold))'), que não aceita sufixo hex.
export function alfa(cor: string | undefined, hexAlfa: string): string {
  if (!cor) return 'transparent';
  if (/^#[0-9a-f]{6}$/i.test(cor)) return cor + hexAlfa;
  return `color-mix(in srgb, ${cor} ${Math.round(parseInt(hexAlfa, 16) / 2.55)}%, transparent)`;
}
