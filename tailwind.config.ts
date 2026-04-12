import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // PRD design tokens
        parchment: {
          DEFAULT: '#f5ede6',
          secondary: '#ecddd4',
        },
        burgundy: {
          DEFAULT: '#8b2035',
          dark: '#3a1a20',
        },
        vino: {
          textPrimary: '#3a1a20',
          textSecondary: '#a07060',
          textMuted: '#c4a090',
          border: '#d4b8aa',
        },
        score: {
          goldFill: '#f5e6b0',
          goldText: '#7a5c00',
          silverFill: '#e8e4e0',
          silverText: '#4a4440',
          bronzeFill: '#f0ddd0',
          bronzeText: '#6a3a20',
        },
        status: {
          drinkNowFill: '#c8e6c9',
          drinkNowText: '#2e5c30',
          openSoonFill: '#fff3e0',
          openSoonText: '#7a4e00',
        },
        winetype: {
          red: '#8b2035',
          white: '#c9a84c',
          rose: '#d4748a',
          champagne: '#c9b86c',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
