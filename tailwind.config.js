/** @type {import('tailwindcss').Config} */

/**
 * Sistema de design — console de turno de brinquedoteca.
 *
 * Quem usa é o funcionário do balcão, o dia inteiro, com mouse e teclado.
 * Tempo e dinheiro são o conteúdo; o resto é instrumentação em volta.
 *
 * Três regras que sustentam tudo:
 *  1. COR CARREGA ESTADO, não decoração. O normal é cinza. Só o que exige
 *     ação do funcionário ganha cor — senão a tela vira um vitral e nada
 *     se destaca.
 *  2. NÚMERO TEM VOZ PRÓPRIA. Relógios e durações saem em mono tabular,
 *     como painel de embarque; valores em grotesk tabular.
 *  3. DENSIDADE DE FERRAMENTA. Mouse e teclado: linha de 40px, controle de
 *     36px, muita informação por tela sem aperto.
 */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Identidade. Violeta continua, mas rebaixado: marca ação primária,
           item ativo e foco — não banha a tela inteira de gradiente. */
        brand: {
          50: '#f4f2ff',
          100: '#eae6ff',
          200: '#d7cfff',
          300: '#b9aaff',
          400: '#957dfa',
          500: '#7854f0',
          600: '#663ade',
          700: '#552cbb',
          800: '#472798',
          900: '#3b247a',
        },

        /* Papel e tinta. Cinza levemente quente: não é o slate frio de
           dashboard de servidor nem o creme de template. */
        paper: {
          DEFAULT: '#f6f6f4',
          sunken: '#eeeeeb',
          raised: '#ffffff',
        },
        ink: {
          900: '#16161a',
          800: '#26262c',
          700: '#3c3c45',
          600: '#55555f',
          500: '#6f6f7a',
          400: '#91919c',
          300: '#b4b4bd',
          200: '#d8d8d6',
          100: '#e8e8e5',
        },
        line: {
          DEFAULT: '#e2e2de',
          strong: '#cfcfca',
          subtle: '#eeeeeb',
        },

        /* Estados do relógio — quanto tempo a criança está dentro.
           Curto e médio são DELIBERADAMENTE neutros: a maioria das visitas
           está aí e não pede nada do funcionário. */
        clock: {
          quiet: '#a3a3ad',   // até 2h — normal, sem alarme
          watch: '#c2820a',   // 2h-3h — começar a olhar
          over: '#c0392f',    // 3h+   — conferir, provavelmente esquecido
        },

        /* Dinheiro. Verde = entrou; âmbar = falta; violeta = pacote. */
        money: {
          in: '#1a7f5a',
          due: '#b5730c',
          package: '#663ade',
        },

        /* Deu certo / precisa de atenção / deu errado.
         *
         * O verde puxa para o azul de propósito: verde-e-vermelho é justamente
         * o par que some para quem tem daltonismo (~8% dos homens), e um verde
         * mais frio continua separável do vermelho. Ainda assim, nenhum estado
         * do app depende só da cor — sempre há rótulo ou número junto. */
        state: {
          ok: '#1a7f5a',
          'ok-soft': '#e7f4ee',
          warn: '#b5730c',
          'warn-soft': '#fdf3e2',
          bad: '#c0392f',
          'bad-soft': '#fbeceb',
        },

        danger: {
          50: '#fdf2f1',
          100: '#fbe3e1',
          300: '#eda9a3',
          500: '#c0392f',
          600: '#a52f26',
          700: '#88271f',
        },

        /* Mantidos por compatibilidade com telas ainda não migradas. */
        accent: {
          500: '#7854f0',
          600: '#663ade',
          700: '#552cbb',
        },
        primary: {
          50: '#fdf2f1',
          100: '#fbe3e1',
          200: '#f6ccc7',
          300: '#eda9a3',
          400: '#dd7167',
          500: '#c0392f',
          600: '#a52f26',
          700: '#88271f',
          800: '#70221c',
          900: '#5c1f1a',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f6f6f4',
          subtle: '#eeeeeb',
        },
      },

      fontFamily: {
        sans: ['Archivo', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        /* Relógios e durações. O painel de visitas ativas lê como painel de
           embarque — é literalmente uma lista de quem chegou e quando sai. */
        mono: ['"Azeret Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      fontSize: {
        /* Rótulo de seção: caixa alta, pequeno, espaçado. */
        caption: ['0.6875rem', { lineHeight: '1rem', fontWeight: '600', letterSpacing: '0.08em' }],
        heading: ['1.0625rem', { lineHeight: '1.5rem', fontWeight: '650', letterSpacing: '-0.01em' }],
        display: ['1.75rem', { lineHeight: '2rem', fontWeight: '700', letterSpacing: '-0.025em' }],
        /* Leitura de instrumento: o número que o funcionário busca de longe. */
        readout: ['2.25rem', { lineHeight: '2.25rem', fontWeight: '600', letterSpacing: '-0.03em' }],
        'readout-sm': ['1.375rem', { lineHeight: '1.5rem', fontWeight: '600', letterSpacing: '-0.02em' }],
      },

      spacing: {
        /* Densidade de ferramenta, não de landing page. */
        row: '2.5rem',      // 40px — altura de linha de lista
        control: '2.25rem', // 36px — altura de botão/input padrão
      },

      borderRadius: {
        card: '0.625rem',
        'card-lg': '0.75rem',
      },

      boxShadow: {
        /* Sombra é para separar plano, não para brilhar. */
        card: '0 1px 2px 0 rgb(22 22 26 / 0.05)',
        'card-hover': '0 2px 8px -2px rgb(22 22 26 / 0.10), 0 1px 3px 0 rgb(22 22 26 / 0.06)',
        'card-lg': '0 12px 32px -12px rgb(22 22 26 / 0.22), 0 2px 8px -4px rgb(22 22 26 / 0.10)',
        brand: '0 2px 8px -2px rgb(102 58 222 / 0.35)',
        'brand-sm': '0 1px 3px 0 rgb(102 58 222 / 0.25)',
        glow: '0 0 0 1px rgb(149 125 250 / 0.35)',
        focus: '0 0 0 2px #ffffff, 0 0 0 4px rgb(102 58 222 / 0.65)',
      },

      backgroundImage: {
        /* Um tom só. O gradiente violeta→fúcsia dava ar de material
           promocional; aqui ele só dá volume ao botão primário. */
        'brand-gradient': 'linear-gradient(180deg, #7854f0 0%, #663ade 100%)',
        'brand-gradient-soft': 'linear-gradient(180deg, #f4f2ff 0%, #eae6ff 100%)',
        'app-bg': '#f6f6f4',
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
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s infinite',
        'bounce-subtle': 'bounce-subtle 1s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.18s ease-out',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
