import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const appVersion = readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim();
process.env.VITE_APP_VERSION = `v${appVersion}`;

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: ["robot-controller", "robot-controller.tail00aec2.ts.net"]
  }
});
