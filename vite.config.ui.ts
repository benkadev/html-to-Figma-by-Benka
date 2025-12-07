import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    plugins: [react(), viteSingleFile()],
    build: {
        target: "esnext",
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        outDir: "dist",
        emptyOutDir: false, // Don't delete code.js if it was built first
        rollupOptions: {
            input: {
                ui: "ui.html"
            },
            output: {
                entryFileNames: "[name].js" // irrelevant for single file but good practice
            }
        }
    }
});
