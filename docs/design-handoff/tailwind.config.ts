import type { Config } from 'tailwindcss';

/* =============================================================================
   h2-flow — Tailwind config
   Extends the original TobyFlow tokens with:
   • shadcn/ui semantic colors (driven by CSS vars in globals.css)
   • violet + coral fixed palettes
   • spacing / radius / typography / elevation scales extracted from the prototype
   ========================================================================== */

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './sidebar.html',
    './workflow-editor.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ---- shadcn semantic (mode-aware via globals.css) ---- */
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: 'hsl(var(--warning))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        /* ---- Fixed brand palettes (use when you need a specific hue regardless of mode) ---- */
        violet: {
          50: '#f3f0fd', 100: '#e7e0fb', 200: '#d0c4f6', 300: '#b39fef',
          400: '#a085ea', 500: '#9177e1', 600: '#7b57d4', 700: '#6843b8',
          800: '#553795', 900: '#463078',
        },
        coral: {
          50: '#fdf3ef', 100: '#fbe5dc', 200: '#f6c9b8', 300: '#efa588',
          400: '#e7855f', 500: '#de6b4a', 600: '#c9532f', 700: '#a84326',
          800: '#883826', 900: '#6f3122',
        },

        /* ---- TobyFlow diagram tokens (FIXED — not mode-dependent) ---- */
        node: {
          generate: '#9177e1', download: '#3b82f6', chatgpt: '#10a37f',
          grok: '#1d9bf0', prompt: '#9177e1', delay: '#71717a', telegram: '#26A5E4',
        },
        port: {
          text: '#9177e1', image: '#3b82f6', video: '#a855f7',
          any: '#71717a', frame: '#14b8a6',
        },
        status: {
          pending: '#71717a', running: '#3b82f6',
          completed: '#10b981', failed: '#ef4444',
        },
      },

      borderRadius: {
        /* control radius derives from --radius (10px); cards step up */
        sm: 'calc(var(--radius) - 4px)',  /* 6  — inner toggles, chips inner */
        DEFAULT: 'var(--radius)',         /* 10 — buttons, inputs, chips */
        md: 'calc(var(--radius) - 2px)',  /* 8 */
        lg: 'calc(var(--radius) + 4px)',  /* 14 — cards, panels */
        xl: 'calc(var(--radius) + 8px)',  /* 18 — prompt card */
      },

      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },

      fontSize: {
        /* role-named sizes pulled from the prototype */
        'eyebrow': ['11px', { lineHeight: '1', letterSpacing: '0.12em', fontWeight: '600' }],
        'label': ['11.5px', { lineHeight: '1.2' }],
        'meta': ['12px', { lineHeight: '1.3' }],
        'body': ['13px', { lineHeight: '1.5' }],
        'input': ['16px', { lineHeight: '1.55' }],
        'section': ['20px', { lineHeight: '1.1' }],   /* display italic */
        'hero': ['44px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },

      spacing: {
        /* extra steps the prototype leans on */
        '4.5': '18px',
        '5.5': '22px',
        '13': '52px',
      },

      boxShadow: {
        card: '0 18px 40px -24px rgba(40,28,12,0.18)',
        'card-dark': '0 24px 60px -20px rgba(0,0,0,0.6)',
        'btn-glow': '0 6px 18px -4px hsl(var(--primary) / 0.5)',
      },

      keyframes: {
        'slide-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'spin-slow': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'spin-slow': 'spin-slow 2s linear infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwindcss-animate'),
  ],
} satisfies Config;
