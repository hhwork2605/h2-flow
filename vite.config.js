import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from './manifest.config';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react(), crx({ manifest })],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            input: {
                sidebar: path.resolve(__dirname, 'sidebar.html'),
                workflowEditor: path.resolve(__dirname, 'workflow-editor.html'),
                anglesEditor: path.resolve(__dirname, 'angles-editor.html'),
                effectsEditor: path.resolve(__dirname, 'effects-editor.html'),
                settings: path.resolve(__dirname, 'settings.html'),
            },
            output: {
                // Chrome MV3 rejects content_scripts whose filename contains extra
                // dots (e.g. `flow.ts-abc.js`). Replace dots in chunk names with `_`.
                entryFileNames: (chunkInfo) => {
                    const safeName = (chunkInfo.name ?? '[name]').replace(/\./g, '_');
                    return `assets/${safeName}-[hash].js`;
                },
                chunkFileNames: (chunkInfo) => {
                    const safeName = (chunkInfo.name ?? '[name]').replace(/\./g, '_');
                    return `assets/${safeName}-[hash].js`;
                },
            },
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
});
