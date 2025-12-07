import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './', // Use relative paths
    build: {
        target: "esnext",
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        outDir: "dist",
        rollupOptions: {
            input: {
                ui: "ui.html", // Entry point for UI
                code: "src/code.ts" // Entry point for Plugin Code
            },
            output: {
                entryFileNames: "[name].js"
            }
        }
    }
});
