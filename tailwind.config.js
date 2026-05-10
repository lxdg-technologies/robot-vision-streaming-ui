import lxdgUi from '../../shared/ui/tailwind.preset.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [lxdgUi],
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {}
  },
  plugins: []
};
