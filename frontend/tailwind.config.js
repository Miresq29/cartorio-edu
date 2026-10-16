export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds - dark navy palette easier on eyes than near-black
        bg: {
          base:     'rgb(var(--c-bg-base) / <alpha-value>)', // main background (slate-900)
          surface:  'rgb(var(--c-bg-surface) / <alpha-value>)', // cards, panels (slate-800)
          elevated: 'rgb(var(--c-bg-elevated) / <alpha-value>)', // raised elements, hover states
          overlay:  'rgb(var(--c-bg-overlay) / <alpha-value>)', // modals, deep panels
        },
        // Text hierarchy — gold palette
        text: {
          primary:   'rgb(var(--c-text-primary) / <alpha-value>)', // near-white — headings on dark bg
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)', // gold — labels, nav items (dark bg)
          muted:     'rgb(var(--c-text-muted) / <alpha-value>)', // dim gold — descriptions, captions (dark bg)
          disabled:  'rgb(var(--c-text-disabled) / <alpha-value>)', // deep gold muted — disabled (dark bg)
          // Content-area gold (readable on white/slate-50)
          'gold-strong': 'rgb(var(--c-gold-strong) / <alpha-value>)', // dark gold — titles on light bg (~5.8:1)
          'gold-body':   'rgb(var(--c-gold-body) / <alpha-value>)', // medium-dark gold — body on light bg (~4.5:1)
          'gold-soft':   'rgb(var(--c-gold-soft) / <alpha-value>)', // soft gold — captions on light bg (~3.5:1)
        },
        // Brand colors
        brand: {
          blue:    'rgb(var(--c-blue-500) / <alpha-value>)', // primary action
          'blue-dim': 'rgb(var(--c-blue-700) / <alpha-value>)', // pressed/active
          gold:    'rgb(var(--c-gold) / <alpha-value>)', // accent / premium
          'gold-dim': 'rgb(var(--c-gold-soft) / <alpha-value>)',
        },
        // Semantic
        success: '#10b981',
        warning: '#f59e0b',
        danger:  '#ef4444',
        info:    '#06b6d4',
        // Borders
        border: {
          DEFAULT: 'rgba(148,163,184,0.12)', // subtle
          strong:  'rgba(148,163,184,0.25)',  // visible
          focus:   '#3b82f6',
        },
        // Light-surface tokens — telas com fundo claro (a maioria do app hoje),
        // navy/dourado/steel são a identidade visual real em uso.
        content: {
          bg:      '#f8fafc',
          surface: '#ffffff',
          border:  '#e2e8f0',
        },
        // Escala azul (ações, item ativo do menu) — padrão = azul do Tailwind; com marca própria é
        // gerada da cor principal do cliente (utils/tema.ts).
        blue: {
          '50': 'rgb(var(--c-blue-50) / <alpha-value>)',
          '100': 'rgb(var(--c-blue-100) / <alpha-value>)',
          '200': 'rgb(var(--c-blue-200) / <alpha-value>)',
          '300': 'rgb(var(--c-blue-300) / <alpha-value>)',
          '400': 'rgb(var(--c-blue-400) / <alpha-value>)',
          '500': 'rgb(var(--c-blue-500) / <alpha-value>)',
          '600': 'rgb(var(--c-blue-600) / <alpha-value>)',
          '700': 'rgb(var(--c-blue-700) / <alpha-value>)',
          '800': 'rgb(var(--c-blue-800) / <alpha-value>)',
          '900': 'rgb(var(--c-blue-900) / <alpha-value>)',
          '950': 'rgb(var(--c-blue-950) / <alpha-value>)',
        },
        navy:  'rgb(var(--c-navy) / <alpha-value>)',
        gold:  'rgb(var(--c-gold) / <alpha-value>)',
        // Nome "steel" (não "slate") de propósito — "slate" já é a escala nativa
        // do Tailwind (slate-50..900), usada em centenas de classes no projeto;
        // sobrescrevê-la quebraria todas elas.
        steel: '#8A9BB0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-blue':  '0 0 20px rgb(var(--c-blue-500) / 0.20)',
        'glow-gold':  '0 0 20px rgb(var(--c-gold) / 0.20)',
        'card':       '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5)',
      },
      borderRadius: {
        'xl2': '1.25rem',
        'xl3': '1.5rem',
      },
    },
  },
  plugins: [],
}
