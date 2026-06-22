import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#F8CB46',
          green: '#0C831F',
          'green-dark': '#0A6E1A',
          'green-light': '#E8F5EC',
          dark: '#1A1A1A'
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.10)'
      }
    }
  },
  plugins: []
};

export default config;
