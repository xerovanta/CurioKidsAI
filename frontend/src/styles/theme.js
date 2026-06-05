/**
 * Unified Design Tokens for CurioKids AI platform.
 * Exports color palettes, gradients, typography, and premium shadow definitions.
 */

export const THEME = {
  colors: {
    purple: {
      light: '#f3e8ff',
      main: '#8b5cf6',
      dark: '#7c3aed'
    },
    pink: {
      light: '#fce7f3',
      main: '#ec4899',
      dark: '#db2777'
    },
    sky: {
      light: '#e0f2fe',
      main: '#0ea5e9',
      dark: '#0284c7'
    },
    emerald: {
      light: '#d1fae5',
      main: '#10b981',
      dark: '#059669'
    },
    amber: {
      light: '#fef3c7',
      main: '#f59e0b',
      dark: '#d97706'
    },
    slate: {
      light: '#f1f5f9',
      main: '#64748b',
      dark: '#334155'
    }
  },

  gradients: {
    memoryMatch: 'from-indigo-400 to-blue-500',
    wordRepeat: 'from-purple-400 to-pink-500',
    airDraw: 'from-teal-400 to-emerald-500',
    alphabetGrab: 'from-amber-400 to-orange-500',
    headerWin: 'from-indigo-500 via-purple-500 to-pink-500',
    default: 'from-sky-400 to-indigo-500'
  },

  shadows: {
    playful: '0 8px 0px 0px rgba(0, 0, 0, 0.12)',
    playfulOrange: '0 8px 0px 0px #c2410c',
    playfulGreen: '0 8px 0px 0px #047857',
    playfulPurple: '0 8px 0px 0px #6d28d9',
    playfulPink: '0 8px 0px 0px #be185d',
    card: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    premium: '0 12px 24px -4px rgba(0, 0, 0, 0.08), 0 8px 16px -4px rgba(0, 0, 0, 0.04)',
    glow: '0 0 20px 4px rgba(139, 92, 246, 0.15)'
  },

  typography: {
    fontKids: '"Fredoka", "Lexend", "Outfit", sans-serif',
    fontSystem: 'system-ui, -apple-system, sans-serif'
  }
};
