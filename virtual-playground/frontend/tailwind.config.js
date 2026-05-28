// ??$$$
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0a16',
          panel: '#12122b',
          border: '#1f1f45',
          accent: '#00f0ff',
          glow: '#7000ff',
          text: '#e2e8f0',
        }
      },
      boxShadow: {
        cyber: '0 0 15px rgba(0, 240, 255, 0.25)',
        purple: '0 0 15px rgba(112, 0, 255, 0.25)',
      }
    },
  },
  plugins: [],
}
