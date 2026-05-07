/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        accent: {
          // segunda cor para gradients (fucsia/pink) — dá vida sem brigar com brand
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
        },
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          subtle: '#f1f5f9',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #f5f3ff 0%, #fae8ff 100%)',
        'app-bg': 'radial-gradient(1200px 600px at 100% -10%, #ede9fe 0%, transparent 60%), radial-gradient(900px 500px at -10% 110%, #fae8ff 0%, transparent 55%), #f8fafc',
      },
      borderRadius: {
        card: '1rem',
        'card-lg': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        'card-hover': '0 8px 20px -6px rgb(15 23 42 / 0.12), 0 4px 8px -4px rgb(15 23 42 / 0.08)',
        'card-lg': '0 20px 40px -12px rgb(15 23 42 / 0.18), 0 8px 16px -8px rgb(15 23 42 / 0.10)',
        brand: '0 8px 20px -6px rgb(124 58 237 / 0.45), 0 4px 8px -4px rgb(192 38 211 / 0.25)',
        'brand-sm': '0 2px 8px -2px rgb(124 58 237 / 0.35)',
        glow: '0 0 0 1px rgb(167 139 250 / 0.25), 0 8px 24px -8px rgb(124 58 237 / 0.35)',
        focus: '0 0 0 3px rgb(139 92 246 / 0.35)',
      },
      fontSize: {
        'display': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700', letterSpacing: '-0.02em' }],
        'heading': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '700', letterSpacing: '-0.01em' }],
        'caption': ['0.6875rem', { lineHeight: '1rem', fontWeight: '600', letterSpacing: '0.06em' }],
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        'bounce-subtle': 'bounce-subtle 1s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
