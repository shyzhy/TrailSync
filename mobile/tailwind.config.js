/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './src/**/*.{js,jsx}'],
  // The app is light-only (app.json sets userInterfaceStyle), and NativeWind refuses to set a scheme under media queries.
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // The same six tokens the web app uses, so a class name means the same thing on both.
      colors: {
        paper: '#FAF8F3',
        ink: '#1F2937',
        blue: '#24406B',
        gold: '#B8872B',
        sage: '#4F7A6A',
        hairline: '#E3DFD2',
        'ink-soft': '#6B7280',
        'ink-faint': '#9CA3AF',
        surface: '#FFFFFF',
        sunken: '#F3F0E8',
        'blue-soft': '#E8EDF5',
        'gold-soft': '#F7EEDC',
        'sage-soft': '#E6EFEA',
        danger: '#B91C1C',
        'danger-soft': '#FDECEC',
      },
      fontFamily: {
        serif: ['SourceSerif4_600SemiBold'],
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
      },
    },
  },
  plugins: [],
};
