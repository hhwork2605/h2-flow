import forms from '@tailwindcss/forms';
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
declare const _default: {
    content: string[];
    darkMode: "class";
    theme: {
        extend: {
            colors: {
                border: string;
                input: string;
                ring: string;
                background: string;
                foreground: string;
                primary: {
                    DEFAULT: string;
                    foreground: string;
                };
                secondary: {
                    DEFAULT: string;
                    foreground: string;
                };
                muted: {
                    DEFAULT: string;
                    foreground: string;
                };
                accent: {
                    DEFAULT: string;
                    foreground: string;
                };
                destructive: {
                    DEFAULT: string;
                    foreground: string;
                };
                success: {
                    DEFAULT: string;
                    foreground: string;
                };
                warning: string;
                card: {
                    DEFAULT: string;
                    foreground: string;
                };
                popover: {
                    DEFAULT: string;
                    foreground: string;
                };
                violet: {
                    50: string;
                    100: string;
                    200: string;
                    300: string;
                    400: string;
                    500: string;
                    600: string;
                    700: string;
                    800: string;
                    900: string;
                };
                coral: {
                    50: string;
                    100: string;
                    200: string;
                    300: string;
                    400: string;
                    500: string;
                    600: string;
                    700: string;
                    800: string;
                    900: string;
                };
                node: {
                    generate: string;
                    download: string;
                    chatgpt: string;
                    grok: string;
                    prompt: string;
                    delay: string;
                    telegram: string;
                };
                port: {
                    text: string;
                    image: string;
                    video: string;
                    any: string;
                    frame: string;
                };
                status: {
                    pending: string;
                    running: string;
                    completed: string;
                    failed: string;
                };
                bg: {
                    base: string;
                    elevate: string;
                    overlay: string;
                };
                text: {
                    1: string;
                    2: string;
                    3: string;
                };
                brand: {
                    50: string;
                    100: string;
                    500: string;
                    700: string;
                    900: string;
                };
                error: string;
                info: string;
                'tip-gold': string;
            };
            borderRadius: {
                sm: string;
                DEFAULT: string;
                md: string;
                lg: string;
                xl: string;
            };
            fontFamily: {
                sans: [string, string, string, string, string];
                display: [string, string, string];
                mono: [string, string, string];
            };
            fontSize: {
                eyebrow: [string, {
                    lineHeight: string;
                    letterSpacing: string;
                    fontWeight: string;
                }];
                label: [string, {
                    lineHeight: string;
                }];
                meta: [string, {
                    lineHeight: string;
                }];
                body: [string, {
                    lineHeight: string;
                }];
                input: [string, {
                    lineHeight: string;
                }];
                section: [string, {
                    lineHeight: string;
                }];
                hero: [string, {
                    lineHeight: string;
                    letterSpacing: string;
                }];
                caption: [string, {
                    lineHeight: string;
                }];
                tag: [string, {
                    lineHeight: string;
                    fontWeight: string;
                }];
                title: [string, {
                    lineHeight: string;
                    fontWeight: string;
                }];
            };
            spacing: {
                '4.5': string;
                '5.5': string;
                '13': string;
            };
            boxShadow: {
                card: string;
                'card-dark': string;
                'btn-glow': string;
            };
            zIndex: {
                sticky: string;
                dropdown: string;
                'sidebar-overlay': string;
                modal: string;
                toast: string;
                'toast-persistent': string;
                'clone-overlay': string;
            };
            keyframes: {
                'slide-up': {
                    '0%': {
                        transform: string;
                    };
                    '100%': {
                        transform: string;
                    };
                };
                'spin-slow': {
                    '0%': {
                        transform: string;
                    };
                    '100%': {
                        transform: string;
                    };
                };
            };
            animation: {
                'slide-up': string;
                'spin-slow': string;
            };
        };
    };
    plugins: (typeof forms | {
        handler: () => void;
    })[];
};
export default _default;
