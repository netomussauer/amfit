/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './shared/**/*.{ts,tsx}', './features/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // White Label (SDD §20.4): var(--color-*) em vez de hex fixo — o
        // ThemeProvider (shared/providers/ThemeProvider.tsx) sobrescreve
        // essas variáveis via NativeWind `vars()` com a cor do personal do
        // aluno logado. Os hex abaixo (mesmos de antes) só entram como
        // fallback do CSS var — sem ThemeProvider montado, nada muda
        // visualmente.
        primary: 'var(--color-primary, #f97316)',
        'primary-hover': 'var(--color-primary-hover, #ea580c)',
        success: '#16a34a',
        danger: '#ef4444',
        warning: '#f59e0b',
      },
    },
  },
  plugins: [],
};
