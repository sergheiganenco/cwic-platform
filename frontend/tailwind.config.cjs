// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    { pattern: /text-(blue|yellow|green|purple|indigo|cyan|emerald|rose)-600/ },
    { pattern: /bg-(blue|yellow|green|purple|indigo|cyan|emerald|rose)-600/ },
  ],
  theme: {
    extend: {
      colors: {
        // Modern color system with better semantic naming
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // Enhanced primary palette - Modern blue/purple gradient
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },

        // Modern accent colors
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          purple: {
            50: '#faf5ff',
            500: '#a855f7',
            600: '#9333ea',
            700: '#7e22ce',
          },
          cyan: {
            50: '#ecfeff',
            500: '#06b6d4',
            600: '#0891b2',
            700: '#0e7490',
          },
          emerald: {
            50: '#ecfdf5',
            500: '#10b981',
            600: '#059669',
            700: '#047857',
          },
          rose: {
            50: '#fff1f2',
            500: '#f43f5e',
            600: '#e11d48',
            700: '#be123c',
          },
        },

        // Enhanced semantic colors
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },

        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },

        success: {
          DEFAULT: '#10b981',
          light: '#d1fae5',
          dark: '#047857',
        },

        warning: {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
          dark: '#d97706',
        },

        info: {
          DEFAULT: '#3b82f6',
          light: '#dbeafe',
          dark: '#1e40af',
        },

        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },

        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },

        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
      },

      // Modern border radius system
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      // Enhanced typography with modern font stack
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
        display: ['Cal Sans', 'Inter var', 'sans-serif'],
      },

      // Modern shadows
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 12px 30px -4px rgba(0, 0, 0, 0.06)',
        'hard': '0 10px 40px -5px rgba(0, 0, 0, 0.15), 0 20px 50px -10px rgba(0, 0, 0, 0.1)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.5)',
        'glow-lg': '0 0 40px rgba(59, 130, 246, 0.6)',
      },

      // Enhanced animations
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 }
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 }
        },
        slideUp: {
          from: { transform: 'translateY(10px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 }
        },
        slideDown: {
          from: { transform: 'translateY(-10px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 }
        },
        slideLeft: {
          from: { transform: 'translateX(10px)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 }
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: 0 },
          to: { transform: 'scale(1)', opacity: 1 }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'slide-left': 'slideLeft 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce': 'bounce 1s ease-in-out infinite',
      },

      // Modern spacing scale
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },

      // Backdrop blur utilities
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
