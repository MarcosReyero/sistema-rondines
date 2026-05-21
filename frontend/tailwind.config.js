/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          100: '#2a2a4a',
          200: '#1e1e3a',
          300: '#1a1a2e',
          400: '#12122a',
          500: '#0d0d1f',
        },
        accent: {
          DEFAULT: '#00d4aa',
          hover: '#00b894',
          dark: '#009a7a',
        },
        danger: {
          DEFAULT: '#e74c3c',
          hover: '#c0392b',
        },
        warning: {
          DEFAULT: '#f39c12',
          hover: '#e67e22',
        },
        success: {
          DEFAULT: '#00d4aa',
          hover: '#00b894',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'scan-line':  'scan-line 2s ease-in-out infinite',
        'scan-pulse': 'scan-pulse 1.4s ease-out forwards',
        'fade-in':    'fade-in 0.5s ease-out forwards',
      },
      keyframes: {
        'scan-line': {
          '0%, 100%': { top: '2px', opacity: '1' },
          '50%': { top: 'calc(100% - 2px)', opacity: '0.7' },
        },
        'scan-pulse': {
          '0%':   { transform: 'scale(1)',   opacity: '0.9' },
          '60%':  { transform: 'scale(2.8)', opacity: '0.3' },
          '100%': { transform: 'scale(3.5)', opacity: '0' },
        },
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}
