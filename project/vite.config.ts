import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Unique id for each build; the running app compares it with /version.json
// to detect that a new version was deployed and reload itself.
const BUILD_ID = process.env.GITHUB_SHA?.slice(0, 12) || Date.now().toString(36);

function versionFile(): Plugin {
  return {
    name: 'lc-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: BUILD_ID, builtAt: new Date().toISOString() }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionFile()],
  base: '/Life-change-APP/',
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_ID),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
