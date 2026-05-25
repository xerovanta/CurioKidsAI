/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        curio: {
          purple: {
            light: '#EEF2FF',
            DEFAULT: '#7B61FF',
            dark: '#6242FF',
          },
          pink: {
            light: '#FDF2F8',
            DEFAULT: '#FF4FA3',
            dark: '#E02E82',
          },
          yellow: {
            light: '#FEF3C7',
            DEFAULT: '#FF9F1C', // use orange as default or yellow
            dark: '#E08500',
          },
          green: {
            light: '#ECFDF5',
            DEFAULT: '#37D67A',
            dark: '#1BBE5E',
          },
          blue: {
            light: '#ECFEFF',
            DEFAULT: '#38B6FF',
            dark: '#1E9DFF',
          },
          orange: {
            light: '#FFF7ED',
            DEFAULT: '#FF9F1C',
            dark: '#E08500',
          },
          cream: '#EAF8FF', // Soft sky blue/cream background sky
          slate: '#1E293B',
        }
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'playful': '0 8px 0px 0px rgba(0, 0, 0, 0.08)',
        'playful-purple': '0 8px 0px 0px #4F46E5',
        'playful-pink': '0 8px 0px 0px #DB2777',
        'playful-green': '0 8px 0px 0px #059669',
        'playful-yellow': '0 8px 0px 0px #D97706',
        'playful-blue': '0 8px 0px 0px #0891B2',
        'playful-orange': '0 8px 0px 0px #EA580C',
        'inner-soft': 'inset 0 4px 6px 0 rgba(0, 0, 0, 0.06)',
      },
      fontFamily: {
        'kids': ['"Fredoka"', '"Nunito"', '"Outfit"', '"Lexend"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'bounce-slow': 'bounce 2.5s infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.02)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
