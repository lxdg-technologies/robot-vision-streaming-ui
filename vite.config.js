import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: ["robot-controller", "robot-controller.tail00aec2.ts.net"]
  }
});
