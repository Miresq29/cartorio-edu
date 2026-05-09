export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds - dark navy palette easier on eyes than near-black
        bg: {
          base:     '#0f172a', // main background (slate-900)
          surface:  '#1e293b', // cards, panels (slate-800)
          elevated: '#263348', // raised elements, hover states
          overlay:  '#0d1b3e', // modals, deep panels
        },
        // Text hierarchy
        text: {
          primary:   '#e2e8f0', // slate-200 — headings, important content
          secondary: '#94a3b8', // slate-400 — body text, labels
          muted:     '#64748b', // slate-500 — placeholders, captions
          disabled:  '#334155', // slate-700 — disabled states
        },
        // Brand colors
        brand: {
          blue:    '#3b82f6', // primary action
          'blue-dim': '#1d4ed8', // pressed/active
          gold:    '#c9a84c', // accent / premium
          'gold-dim': '#a8882f',
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-blue':  '0 0 20px rgba(59,130,246,0.20)',
        'glow-gold':  '0 0 20px rgba(201,168,76,0.20)',
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
