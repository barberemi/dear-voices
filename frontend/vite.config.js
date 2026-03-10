import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Plugin qui injecte le contenu du widget.css dans widget-entry.jsx
// sous la constante WIDGET_CSS (utilisée pour le Shadow DOM)
function injectWidgetCss() {
  return {
    name: 'inject-widget-css',
    transform(code, id) {
      if (id.includes('widget-entry.jsx')) {
        const cssPath = path.resolve(__dirname, 'src/widget/widget.css');
        const css = fs.readFileSync(cssPath, 'utf-8').replace(/`/g, '\\`');
        return code.replace('WIDGET_CSS', `\`${css}\``);
      }
    },
  };
}

// Détermine quel build faire selon la variable d'env VITE_BUILD_TARGET
const isWidget = process.env.VITE_BUILD_TARGET === 'widget';

export default defineConfig({
  plugins: [react(), injectWidgetCss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  // Expose dev-widget.html comme page supplémentaire du dev server
  appType: 'mpa',
  build: isWidget
    ? {
        // ── Build du widget embarquable ──
        outDir: 'dist-widget',
        lib: {
          entry: 'src/widget/widget-entry.jsx',
          name: 'DearVoicesWidget',
          fileName: 'widget',
          formats: ['iife'], // IIFE = s'exécute directement via <script>
        },
        rollupOptions: {
          // React bundlé dans le widget pour qu'il soit autonome
          external: [],
        },
      }
    : {
        // ── Build de l'app principale ──
        outDir: 'dist',
      },
  define: isWidget ? { 'process.env.NODE_ENV': '"production"' } : {},
});
