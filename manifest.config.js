import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };
export default defineManifest({
    manifest_version: 3,
    name: 'h2-flow',
    short_name: 'h2-flow',
    version: pkg.version,
    description: pkg.description,
    icons: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
    },
    action: {
        default_title: 'h2-flow',
    },
    permissions: [
        'activeTab',
        'storage',
        'unlimitedStorage',
        'sidePanel',
        'scripting',
        'tabs',
        'downloads',
        'notifications',
        'alarms',
    ],
    host_permissions: [
        'https://labs.google/*',
        '*://chatgpt.com/*',
        '*://gemini.google.com/*',
        'https://grok.com/*',
        'https://*.grok.com/*',
        'https://your-backend.example.com/*',
    ],
    background: {
        service_worker: 'src/background/index.ts',
        type: 'module',
    },
    side_panel: {
        default_path: 'sidebar.html',
    },
    content_scripts: [
        {
            matches: ['https://labs.google/fx/*'],
            js: ['src/content/flow.ts'],
            run_at: 'document_idle',
        },
        {
            matches: ['https://labs.google/fx/*'],
            js: ['src/content/slate-bridge.ts'],
            world: 'MAIN',
            run_at: 'document_idle',
        },
        {
            matches: ['*://chatgpt.com/*'],
            js: ['src/content/chatgpt.ts'],
            run_at: 'document_idle',
        },
        {
            matches: ['https://grok.com/*', 'https://*.grok.com/*'],
            js: ['src/content/grok.ts'],
            run_at: 'document_idle',
        },
        {
            matches: ['*://gemini.google.com/*'],
            js: ['src/content/gemini.ts'],
            run_at: 'document_idle',
        },
        {
            // Google OAuth success page (backend-rendered). Update this match if
            // you change VITE_API_BASE_URL to a different host. See
            // docs/08-api-contract.md §2 "Google OAuth redirect flow".
            matches: ['https://your-backend.example.com/auth/google/success*'],
            js: ['src/content/oauth-bridge.ts'],
            run_at: 'document_start',
        },
    ],
    commands: {
        generate: {
            suggested_key: { default: 'Alt+G' },
            description: 'Generate with current prompt',
        },
        'toggle-sidebar': {
            suggested_key: { default: 'Alt+S' },
            description: 'Toggle sidebar',
        },
    },
    content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'self';",
    },
    web_accessible_resources: [
        {
            matches: ['https://labs.google/*'],
            resources: [
                'sidebar.html',
                'workflow-editor.html',
                'angles-editor.html',
                'effects-editor.html',
                'settings.html',
                'assets/*',
            ],
        },
    ],
});
