/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0d1117',
        'bg-surface': '#161b22',
        'border-subtle': '#30363d',
        'text-primary': '#e6edf3',
        'text-secondary': '#8b949e',
        'gain': '#3fb950',
        'loss': '#f85149',
        'accent': '#58a6ff',
        'alert': '#d29922',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
