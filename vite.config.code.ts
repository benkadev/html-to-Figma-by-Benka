import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: "es2015",
        outDir: "dist",
        emptyOutDir: false, // Don't delete ui.html
        minify: false,
        rollupOptions: {
            input: {
                code: "src/code.ts"
            },
            output: {
                entryFileNames: "[name].js",
                format: "iife"
            }
        }
    }
});
