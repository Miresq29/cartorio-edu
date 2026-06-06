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
        // Text hierarchy — gold palette
        text: {
          primary:   '#e2e8f0', // near-white — headings on dark bg
          secondary: '#c9a84c', // gold — labels, nav items (dark bg)
          muted:     '#a8882f', // dim gold — descriptions, captions (dark bg)
          disabled:  '#6b5120', // deep gold muted — disabled (dark bg)
          // Content-area gold (readable on white/slate-50)
          'gold-strong': '#7a5c1e', // dark gold — titles on light bg (~5.8:1)
          'gold-body':   '#8a6e2f', // medium-dark gold — body on light bg (~4.5:1)
          'gold-soft':   '#a8882f', // soft gold — captions on light bg (~3.5:1)
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
