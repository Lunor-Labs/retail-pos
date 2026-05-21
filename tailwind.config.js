/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: '#1B6B4F',
          soft: '#E8F1ED',
          ink: '#0F3F2F',
        },
        canvas: '#F7F6F2',
        panel: {
          DEFAULT: '#FFFFFF',
          2: '#FBFAF7',
        },
        ink: {
          DEFAULT: '#15171A',
          2: '#3A3F46',
        },
        muted: '#7C828B',
        faint: '#B5BAC2',
        warn: {
          DEFAULT: '#B45309',
          soft: '#FBF1E0',
        },
        danger: {
          DEFAULT: '#B0341F',
          soft: '#FBEAE5',
        },
        sidebar: {
          DEFAULT: '#0E0F12',
          2: '#16181C',
          ink: '#E6E7E9',
          muted: '#7E848D',
        },
      },
    },
  },
  plugins: [],
};
