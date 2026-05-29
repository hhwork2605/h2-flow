import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import animate from 'tailwindcss-animate';

/**
 * h2-flow — Tailwind config
 *
 * Token theo Claude Design handoff (xem `docs/design-handoff/HANDOFF.md`):
 *  - Light = warm cream + coral (#de6b4a)
 *  - Dark  = near-black + violet (#9177e1) — trùng `node.generate` của workflow editor.
 *
 * Hai lớp token cùng song hành:
 *  1. **shadcn semantic** (`background`, `foreground`, `primary`, `card`, …) — canonical,
 *     dùng cho code mới + mọi component shadcn/ui.
 *  2. **Legacy aliases** (`bg.base`, `text.1-3`, `border`, `brand-500`, …) — giữ để
 *     71 file đang dùng không break; trỏ về vars mới trong `src/index.css`.
 *
 * Khi viết mới: ƯU TIÊN class semantic (`bg-card`, `text-muted-foreground`, `border`).
 */
export default {
  content: [
    './sidebar.html',
    './workflow-editor.html',
    './angles-editor.html',
    './effects-editor.html',
    './settings.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* ─── shadcn semantic — mode-aware via CSS vars (src/index.css) ─── */
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

        /* ─── Fixed brand palettes — dùng khi cần hue tuyệt đối ─── */
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

        /* ─── Workflow diagram tokens — FIXED, không đổi theo mode ─── */
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

        /* ─── Legacy aliases (back-compat 71 file hiện có) ───
         * Map qua CSS vars có alpha — vẫn tương thích `<alpha-value>` Tailwind. */
        bg: {
          base: 'rgb(var(--bg-base) / <alpha-value>)',
          elevate: 'rgb(var(--bg-elevate) / <alpha-value>)',
          overlay: 'rgb(var(--bg-overlay) / <alpha-value>)',
        },
        text: {
          1: 'rgb(var(--text-1) / <alpha-value>)',
          2: 'rgb(var(--text-2) / <alpha-value>)',
          3: 'rgb(var(--text-3) / <alpha-value>)',
        },
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        error: '#ef4444',
        info: '#3b82f6',
        'tip-gold': '#f59e0b',
      },

      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',  /* 6  — inner toggles, chips inner */
        DEFAULT: 'var(--radius)',         /* 10 — buttons, inputs, chips */
        md: 'calc(var(--radius) - 2px)',  /* 8 */
        lg: 'calc(var(--radius) + 4px)',  /* 14 — cards, panels */
        xl: 'calc(var(--radius) + 8px)',  /* 18 — prompt card */
      },

      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        /* Role-named sizes từ prototype */
        eyebrow: ['11px', { lineHeight: '1', letterSpacing: '0.12em', fontWeight: '600' }],
        label: ['11.5px', { lineHeight: '1.2' }],
        meta: ['12px', { lineHeight: '1.3' }],
        body: ['13px', { lineHeight: '1.5' }],
        input: ['16px', { lineHeight: '1.55' }],
        section: ['20px', { lineHeight: '1.1' }],   /* display italic */
        hero: ['44px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        /* Legacy aliases (back-compat) */
        caption: ['11px', { lineHeight: '1.4' }],
        tag: ['10px', { lineHeight: '1.2', fontWeight: '500' }],
        title: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
      },

      spacing: {
        '4.5': '18px',
        '5.5': '22px',
        '13': '52px',
      },

      boxShadow: {
        card: '0 18px 40px -24px rgba(40,28,12,0.18)',
        'card-dark': '0 24px 60px -20px rgba(0,0,0,0.6)',
        'btn-glow': '0 6px 18px -4px hsl(var(--primary) / 0.5)',
      },

      zIndex: {
        sticky: '10',
        dropdown: '20',
        'sidebar-overlay': '40',
        modal: '50',
        toast: '60',
        'toast-persistent': '70',
        'clone-overlay': '100',
      },

      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'spin-slow': 'spin-slow 2s linear infinite',
      },
    },
  },
  plugins: [forms, animate],
} satisfies Config;
